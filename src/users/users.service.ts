import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { parse as parseCsvStream } from 'fast-csv';
import { ClsService } from 'nestjs-cls';
import {
  CannotModifySelfException,
  EmailTakenException,
  IdentifierTakenException,
  IncorrectPasswordException,
  PasswordSameAsOldException,
  UserNotFoundException,
} from 'src/errors/exceptions/business.exception';
import { Readable } from 'stream';
import { PrismaService } from '../database/prisma.service';
import { Prisma, UserRole, UserStatus } from '../generated/prisma/client';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_SELECT = {
  id: true,
  tenantId: true,
  role: true,
  identifier: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  avatar: true,
  status: true,
  mfaEnabled: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  // studentProfile: true,
  // teacherProfile: true,
  // guardianProfile: true,
  // staffProfile: true,
} satisfies Prisma.UserSelect;

type UserWithProfiles = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

const PROFILE_KEYS = [
  'studentProfile',
  'teacherProfile',
  'guardianProfile',
  'staffProfile',
] as const;

/** Returns user without nested profile objects to avoid duplicating id, tenantId, identifier, etc. */
function shapeUserByRole(user: UserWithProfiles): Record<string, unknown> {
  const { ...rest } = user;
  const base = { ...rest };
  PROFILE_KEYS.forEach((key) => delete base[key]);
  return base as Record<string, unknown>;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  // CREATE USER
  async create(dto: CreateUserDto, createdBy?: string) {
    const tenantId = this.cls.get<string>('tenantId');

    // Guardians must provide identifier
    if (dto.role === UserRole.GUARDIAN && !dto.identifier?.trim()) {
      throw new BadRequestException('identifier is required for guardians');
    }

    // Check the email is not already taken within this school (only when email is provided)
    const emailProvided = dto.email != null && dto.email.trim() !== '';
    if (emailProvided) {
      const existingEmail = await this.prisma.user.findFirst({
        where: { tenantId, email: dto.email!.trim() },
      });
      if (existingEmail) {
        throw new ConflictException(
          `A user with the email ${dto.email} already exists in this school.`,
        );
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    // If user creation fails, rollback the transaction so there is no orphaned users in the db
    const user = await this.prisma.$transaction(async (tx) => {
      // Resolve effective identifier (and optional profile codes) inside tx for consistency
      const resolved = await this.resolveIdentifierAndProfileCodes(
        tx,
        tenantId,
        dto,
      );
      const identifier = resolved.identifier;

      // Check the identifier is not already taken within this school
      const existingUser = await tx.user.findFirst({
        where: { tenantId, identifier },
      });
      if (existingUser) {
        throw new IdentifierTakenException(identifier);
      }

      // Create the base user
      const newUser = await tx.user.create({
        data: {
          tenantId,
          role: dto.role,
          identifier,
          firstName: dto.first_name,
          lastName: dto.last_name,
          email: dto.email,
          phone: dto.phone,
          passwordHash,
          status: 'ACTIVE',
        },
      });

      // Create the role-specific profile (with resolved matric/employeeId when applicable)
      await this.createRoleSpecificProfile(
        tx,
        newUser.id,
        tenantId,
        dto,
        resolved,
      );

      return newUser;
    });

    this.logger.log(
      `User '${user.identifier}' (${user.role}) created in school '${tenantId}' by '${createdBy ?? 'system'}'`,
    );

    const created = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: USER_SELECT,
    });
    return created ? shapeUserByRole(created) : null;
  }

  // Find All (with search, filter, pagination)
  async findAll(dto: QueryUsersDto) {
    const tenantId = this.cls.get<string>('tenantId');
    const { page = 1, limit = 20, search, status, role, class_id } = dto;

    // Build the user where clause dynamically based on the search, status, role, and classId provided
    const where: Prisma.UserWhereInput = {
      tenantId,
      ...(role && { role }),
      ...(status && { status }),
      // Search across name, email, matric number, employee ID, guardian ID, or identifier
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { identifier: { contains: search, mode: 'insensitive' } },
          {
            studentProfile: {
              matricNumber: { contains: search, mode: 'insensitive' },
            },
          },
          {
            teacherProfile: {
              employeeId: { contains: search, mode: 'insensitive' },
            },
          },
          {
            guardianProfile: {
              userId: { contains: search, mode: 'insensitive' },
            },
          },
        ],
      }),

      // Filter students by classId when class_id is provided (only when role is not set or role is STUDENT)
      ...(class_id &&
        (!role || role === UserRole.STUDENT) && {
          role: UserRole.STUDENT,
          studentProfile: { classId: class_id },
        }),
    };

    // Run count and data fetch in parallel using Promise.all
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: USER_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: users.map((u) => shapeUserByRole(u)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    };
  }

  /** Internal: returns full user or throws. Use findOne for API (shaped) response. */
  private async getOneOrThrow(id: string): Promise<UserWithProfiles> {
    const tenantId = this.cls.get<string>('tenantId');
    const user = await this.prisma.user.findUnique({
      where: { id, tenantId },
      select: USER_SELECT,
    });
    // console.log(user);
    if (!user) throw new UserNotFoundException();
    return user;
  }

  // Find One
  async findOne(id: string) {
    const user = await this.getOneOrThrow(id);
    return shapeUserByRole(user);
  }

  // Update User
  async update(id: string, dto: UpdateUserDto) {
    const tenantId = this.cls.get<string>('tenantId');

    // Verify user exists in the tenant before updating the user
    await this.getOneOrThrow(id);

    // If email is being changed, check it's not already taken by another user in the tenant
    if (dto.email) {
      const existingEmail = await this.prisma.user.findFirst({
        where: { tenantId, email: dto.email, NOT: { id } },
      });
      if (existingEmail) {
        throw new EmailTakenException(dto.email);
      }
    }

    // Split profile-only fields; map DTO snake_case to Prisma camelCase for base user
    const {
      qualification,
      subject_ids,
      department_id,
      class_id,
      first_name,
      last_name,
      phone_number,
      ...rest
    } = dto;

    const baseUserData: Prisma.UserUpdateInput = {
      ...(first_name !== undefined && { firstName: first_name }),
      ...(last_name !== undefined && { lastName: last_name }),
      ...(phone_number !== undefined && { phone: phone_number }),
      ...(rest.email !== undefined && { email: rest.email }),
      ...(rest.avatar !== undefined && { avatar: rest.avatar }),
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id, tenantId },
        data: baseUserData,
      });

      if (qualification || subject_ids || department_id) {
        await tx.teacherProfile.updateMany({
          where: { userId: id },
          data: {
            ...(qualification !== undefined && { qualification }),
            ...(subject_ids !== undefined && { subjectIds: subject_ids }),
            ...(department_id !== undefined && { departmentId: department_id }),
          },
        });
      }

      if (class_id !== undefined) {
        await tx.studentProfile.updateMany({
          where: { userId: id },
          data: { classId: class_id },
        });
      }
    });

    const user = await this.getOneOrThrow(id);
    return shapeUserByRole(user);
  }

  // Suspend User
  async suspend(id: string, suspendedBy?: string) {
    const tenantId = this.cls.get<string>('tenantId');
    const user = await this.getOneOrThrow(id);

    if (user.status === 'SUSPENDED') {
      throw new BadRequestException('User is already suspended');
    }

    if (id === suspendedBy) {
      throw new CannotModifySelfException('suspend');
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException('You cannot suspend a super admin');
    }

    if (user.status === 'DELETED') {
      throw new BadRequestException('User is already deleted');
    }

    await this.prisma.user.update({
      where: { id, tenantId },
      data: { status: UserStatus.SUSPENDED },
    });

    // Invalidate all their refresh tokens and revoke all their tokens
    await this.prisma.refreshToken.deleteMany({
      where: { userId: id },
    });

    this.logger.log(
      `User '${user.identifier}' (${user.role}) suspended in school '${tenantId}' by '${suspendedBy ?? 'system'}'`,
    );

    return { message: 'User suspended successfully' };
  }

  // Reactivate User
  async reactivate(id: string) {
    const user = await this.getOneOrThrow(id);

    if (user.status === 'ACTIVE') {
      throw new BadRequestException('User is already active');
    }

    await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.ACTIVE },
    });

    return { message: 'User reactivated successfully' };
  }

  // Delete User
  async remove(id: string, deletedBy?: string) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.getOneOrThrow(id);

    if (id === deletedBy) {
      throw new ForbiddenException('You cannot delete your account');
    }

    // Cascade deletes the profile and refresh tokens automatically
    await this.prisma.user.delete({
      where: { id, tenantId },
    });

    this.logger.log(
      `User '${id}' deleted in school '${tenantId}' by '${deletedBy ?? 'system'}'`,
    );

    return { message: 'User deleted successfully' };
  }

  // Change Password by user
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const tenantId = this.cls.get<string>('tenantId');
    const user = await this.prisma.user.findUnique({
      where: { id: userId, tenantId },
    });

    const isCurrentPasswordValid = await bcrypt.compare(
      dto.current_password,
      user?.passwordHash ?? '',
    );

    if (!isCurrentPasswordValid) {
      throw new IncorrectPasswordException();
    }

    if (dto.new_password === dto.current_password) {
      throw new PasswordSameAsOldException();
    }

    const newHash = await bcrypt.hash(dto.new_password, 12);

    await this.prisma.user.update({
      where: { id: userId, tenantId },
      data: { passwordHash: newHash },
    });

    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    return { message: 'Password changed successfully. Please login again.' };
  }

  // Reset Password by admin
  async adminResetPassword(
    targetUserId: string,
    dto: AdminResetPasswordDto,
    adminId: string,
  ) {
    await this.getOneOrThrow(targetUserId);

    const newHash = await bcrypt.hash(dto.new_password, 12);

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { passwordHash: newHash },
    });

    await this.prisma.refreshToken.deleteMany({
      where: { userId: targetUserId },
    });

    this.logger.log(
      `Password reset for user '${targetUserId}' by admin '${adminId}'`,
    );

    return { message: 'Password reset successfully. Please login again.' };
  }

  // Bulk Upload Users from CSV
  async bulkImport(fileBuffer: Buffer, role: UserRole) {
    const tenantId = this.cls.get<string>('tenantId');
    const results: {
      success: { identifier: string; role: UserRole }[];
      failed: { row: number; reason: string }[];
    } = { success: [], failed: [] };

    // Parse the CSV file into an array of rows
    const rows = await this.parseCsv(fileBuffer);

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      try {
        if (!row.firstName || !row.lastName || !row.identifier) {
          results.failed.push({
            row: rowNumber,
            reason:
              'Missing required fields: firstName, lastName, and identifier',
          });
          continue;
        }

        const existing = await this.prisma.user.findFirst({
          where: { tenantId, identifier: row.identifier },
        });
        if (existing) {
          results.failed.push({
            row: rowNumber,
            reason: `User with identifier ${row.identifier} already exists`,
          });
          continue;
        }

        // Default password is the identifier: users must change it after login (required)
        const password = await bcrypt.hash(row.identifier, 12);

        await this.prisma.$transaction(async (tx) => {
          const identifier = row.identifier;
          const staffRoles: UserRole[] = [
            UserRole.COUNSELOR,
            UserRole.LAB_ATTENDANT,
            UserRole.NURSE,
            UserRole.LIBRARIAN,
            UserRole.BURSAR,
            UserRole.SECURITY_OFFICER,
            UserRole.SUPPORT_STAFF,
            UserRole.OTHER,
          ];
          const resolved =
            role === UserRole.STUDENT
              ? {
                  identifier,
                  matricNumber: row.matricNumber ?? identifier,
                }
              : role === UserRole.TEACHER || staffRoles.includes(role)
                ? {
                    identifier,
                    employeeId: row.employeeId ?? identifier,
                  }
                : { identifier };

          const user = await tx.user.create({
            data: {
              tenantId: tenantId,
              role,
              identifier,
              firstName: row.firstName,
              lastName: row.lastName,
              email: row.email || null,
              phone: row.phone || null,
              passwordHash: password,
              status: 'ACTIVE',
            },
          });

          const profileDto: CreateUserDto = { role, ...row } as CreateUserDto;
          await this.createRoleSpecificProfile(
            tx,
            user.id,
            tenantId,
            profileDto,
            resolved,
          );
        });

        results.success.push({ identifier: row.identifier, role });
      } catch (error) {
        results.failed.push({
          row: rowNumber,
          reason: `Error processing row: ${error}`,
        });
      }

      this.logger.log(
        `Bulk import: ${results.success.length} users imported, ${results.failed.length} failed in this school ${tenantId}`,
      );
    }
    return {
      imported: results.success.length,
      failed: results.failed.length,
      failedRows: results.failed,
      message: `${results.success.length} users imported successfully`,
    };
  }

  // User Statistics
  async getSchoolStats() {
    const tenantId = this.cls.get<string>('tenantId');

    // Count all roles in parallel
    const [
      studentCount,
      teacherCount,
      guardianCount,
      staffCount,
      activeCount,
      suspendedCount,
      deletedCount,
    ] = await Promise.all([
      this.prisma.user.count({ where: { tenantId, role: UserRole.STUDENT } }),
      this.prisma.user.count({ where: { tenantId, role: UserRole.TEACHER } }),
      this.prisma.user.count({ where: { tenantId, role: UserRole.GUARDIAN } }),
      this.prisma.user.count({
        where: {
          tenantId,
          role: {
            in: [
              UserRole.COUNSELOR,
              UserRole.LAB_ATTENDANT,
              UserRole.NURSE,
              UserRole.LIBRARIAN,
              UserRole.BURSAR,
              UserRole.SECURITY_OFFICER,
              UserRole.SUPPORT_STAFF,
            ],
          },
        },
      }),
      this.prisma.user.count({
        where: { tenantId, status: UserStatus.ACTIVE },
      }),
      this.prisma.user.count({
        where: { tenantId, status: UserStatus.SUSPENDED },
      }),
      this.prisma.user.count({
        where: { tenantId, status: UserStatus.DELETED },
      }),
    ]);

    return {
      total_students: studentCount,
      total_teachers: teacherCount,
      total_parents: guardianCount,
      total_staff: staffCount,
      total_active: activeCount,
      total_suspended: suspendedCount,
      total_deleted: deletedCount,
      total: studentCount + teacherCount + guardianCount + staffCount,
    };
  }

  /** Resolves User.identifier and optional matricNumber/employeeId; auto-generates when not provided (students/teachers/staff). */
  private async resolveIdentifierAndProfileCodes(
    tx: Prisma.TransactionClient,
    tenantId: string,
    dto: CreateUserDto,
  ): Promise<{
    identifier: string;
    matricNumber?: string;
    employeeId?: string;
  }> {
    const prefix = await this.getTenantPrefix(tenantId);

    if (dto.role === UserRole.STUDENT) {
      const matricNumber =
        dto.matric_number?.trim() ||
        dto.identifier?.trim() ||
        (await this.getNextMatricNumber(tx, tenantId, prefix));
      return { identifier: matricNumber, matricNumber };
    }

    if (dto.role === UserRole.TEACHER) {
      const employeeId =
        dto.employee_id?.trim() ||
        dto.identifier?.trim() ||
        (await this.getNextTeacherEmployeeId(tx, tenantId, prefix));
      return { identifier: employeeId, employeeId };
    }

    const staffRoles: UserRole[] = [
      UserRole.COUNSELOR,
      UserRole.LAB_ATTENDANT,
      UserRole.NURSE,
      UserRole.LIBRARIAN,
      UserRole.BURSAR,
      UserRole.SECURITY_OFFICER,
      UserRole.SUPPORT_STAFF,
      UserRole.OTHER,
    ];
    if (staffRoles.includes(dto.role)) {
      const employeeId =
        dto.employee_id?.trim() ||
        dto.identifier?.trim() ||
        (await this.getNextStaffEmployeeId(tx, tenantId, prefix));
      return { identifier: employeeId, employeeId };
    }

    // GUARDIAN: identifier required (validated in create())
    const identifier = dto.identifier?.trim();
    if (!identifier) {
      throw new BadRequestException('identifier is required for guardians');
    }
    return { identifier };
  }

  /** Returns tenant initials (e.g. GFA) or slug when initials not set. Used for matric/employee ID prefixes. */
  private async getTenantPrefix(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { initials: true, slug: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const base = String(tenant.initials ?? tenant.slug).trim();
    return base ? base.toUpperCase() : String(tenant.slug).toUpperCase();
  }

  /** Format: {prefix}/{year}/{4-digit number}, e.g. GFA/2026/0001 */
  private async getNextMatricNumber(
    tx: Prisma.TransactionClient,
    tenantId: string,
    prefix: string,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const matricPrefix = `${prefix}/${year}/`;
    const last = await tx.studentProfile.findFirst({
      where: { tenantId, matricNumber: { startsWith: matricPrefix } },
      orderBy: { matricNumber: 'desc' },
      select: { matricNumber: true },
    });
    const numPart = last
      ? String(last.matricNumber).slice(matricPrefix.length)
      : '';
    const nextNum = numPart ? parseInt(numPart, 10) + 1 : 1;
    return `${matricPrefix}${String(nextNum).padStart(4, '0')}`;
  }

  /** Format: {prefix}/TCH/{3-digit number}, e.g. GFA/TCH/001 */
  private async getNextTeacherEmployeeId(
    tx: Prisma.TransactionClient,
    tenantId: string,
    prefix: string,
  ): Promise<string> {
    const empPrefix = `${prefix}/TCH/`;
    const last = await tx.teacherProfile.findFirst({
      where: { tenantId, employeeId: { startsWith: empPrefix } },
      orderBy: { employeeId: 'desc' },
      select: { employeeId: true },
    });
    const numPart = last ? String(last.employeeId).slice(empPrefix.length) : '';
    const nextNum = numPart ? parseInt(numPart, 10) + 1 : 1;
    return `${empPrefix}${String(nextNum).padStart(3, '0')}`;
  }

  /** Format: {prefix}/EMP/{3-digit number}, e.g. GFA/EMP/001 */
  private async getNextStaffEmployeeId(
    tx: Prisma.TransactionClient,
    tenantId: string,
    prefix: string,
  ): Promise<string> {
    const empPrefix = `${prefix}/EMP/`;
    const last = await tx.staffProfile.findFirst({
      where: { tenantId, employeeId: { startsWith: empPrefix } },
      orderBy: { employeeId: 'desc' },
      select: { employeeId: true },
    });
    const numPart = last ? String(last.employeeId).slice(empPrefix.length) : '';
    const nextNum = numPart ? parseInt(numPart, 10) + 1 : 1;
    return `${empPrefix}${String(nextNum).padStart(3, '0')}`;
  }

  // Creates the role-specific profile after creating the base user
  private async createRoleSpecificProfile(
    tx: Prisma.TransactionClient,
    userId: string,
    tenantId: string,
    dto: CreateUserDto,
    resolved: {
      identifier: string;
      matricNumber?: string;
      employeeId?: string;
    },
  ) {
    switch (dto.role) {
      case UserRole.STUDENT:
        await tx.studentProfile.create({
          data: {
            userId,
            tenantId,
            matricNumber: resolved.matricNumber ?? resolved.identifier,
            classId: dto.class_id ?? '',
            admissionDate: dto.admission_date
              ? new Date(dto.admission_date)
              : null,
            dateOfBirth: dto.date_of_birth ? new Date(dto.date_of_birth) : null,
          },
        });
        break;

      case UserRole.TEACHER:
        await tx.teacherProfile.create({
          data: {
            userId,
            tenantId,
            employeeId: resolved.employeeId ?? resolved.identifier,
            qualification: dto.qualification ?? null,
            subjectIds: dto.subject_ids ?? [],
          },
        });
        break;

      case UserRole.GUARDIAN:
        await tx.guardianProfile.create({
          data: {
            userId,
            tenantId,
            occupation: dto.occupation ?? '',
            relationship: dto.relationship ?? '',
            wardIds: dto.ward_ids ?? [],
          },
        });
        break;

      case UserRole.COUNSELOR:
      case UserRole.LAB_ATTENDANT:
      case UserRole.NURSE:
      case UserRole.LIBRARIAN:
      case UserRole.BURSAR:
      case UserRole.SECURITY_OFFICER:
      case UserRole.SUPPORT_STAFF:
      case UserRole.OTHER:
        await tx.staffProfile.create({
          data: {
            userId,
            tenantId,
            employeeId: resolved.employeeId ?? resolved.identifier,
            staffType: dto.staff_type ?? dto.role.toLowerCase(),
          },
        });
        break;

      default:
        break;
    }
  }

  // Parses a CSV buffer into an array of row objects
  private parseCsv(buffer: Buffer): Promise<Record<string, string>[]> {
    return new Promise((resolve, reject) => {
      const rows: Record<string, string>[] = [];
      const stream = Readable.from(buffer);

      stream
        .pipe(parseCsvStream())
        .on('data', (row: Record<string, string>) => rows.push(row))
        .on('end', () => resolve(rows))
        .on('error', reject);
    });
  }
}
