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
import {
  QueryParentsDto,
  QueryTeachersDto,
  QueryUsersDto,
} from './dto/query-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { assertCanAssignUserRole } from './policies/user-role-assignment.policy';

const USER_SELECT = {
  id: true,
  tenant_id: true,
  role: true,
  identifier: true,
  first_name: true,
  last_name: true,
  gender: true,
  email: true,
  phone: true,
  avatar: true,
  status: true,
  mfa_enabled: true,
  last_login_at: true,
  created_at: true,
  updated_at: true,

  // studentProfile: true,
  // teacherProfile: true,
  // guardianProfile: true,
  // staffProfile: true,
} satisfies Prisma.UserSelect;

type UserWithProfiles = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

const PROFILE_KEYS = [
  'student_profile',
  'teacher_profile',
  'guardian_profile',
  'staff_profile',
] as const;

/** Extra fields when listing users who may be students (keeps teacher/guardian lists lean). */
const USER_LIST_STUDENT_PROFILE_SELECT = {
  matric_number: true,
  class_id: true,

  class: {
    select: {
      id: true,
      name: true,
      level: true,
      department_id: true,
    },
  },
} satisfies Prisma.StudentProfileSelect;

const USER_LIST_WITH_STUDENT_DETAILS = {
  ...USER_SELECT,
  student_profile: { select: USER_LIST_STUDENT_PROFILE_SELECT },
} satisfies Prisma.UserSelect;

type UserListRowWithStudent = Prisma.UserGetPayload<{
  select: typeof USER_LIST_WITH_STUDENT_DETAILS;
}>;

const USER_LIST_TEACHER_PROFILE_SELECT = {
  employee_id: true,
  qualification: true,
  class_of_degree: true,
  course_of_study: true,
  year_of_graduation: true,
} satisfies Prisma.TeacherProfileSelect;

const USER_LIST_WITH_TEACHER_DETAILS = {
  ...USER_SELECT,
  teacher_profile: { select: USER_LIST_TEACHER_PROFILE_SELECT },
} satisfies Prisma.UserSelect;

type UserListRowWithTeacher = Prisma.UserGetPayload<{
  select: typeof USER_LIST_WITH_TEACHER_DETAILS;
}>;

const USER_LIST_GUARDIAN_PROFILE_SELECT = {
  occupation: true,
  relationship: true,
  ward_ids: true,
} satisfies Prisma.GuardianProfileSelect;

const USER_LIST_WITH_GUARDIAN_DETAILS = {
  ...USER_SELECT,
  relationship: true,
  guardian_profile: { select: USER_LIST_GUARDIAN_PROFILE_SELECT },
} satisfies Prisma.UserSelect;

type UserListRowWithGuardian = Prisma.UserGetPayload<{
  select: typeof USER_LIST_WITH_GUARDIAN_DETAILS;
}>;

const USER_LIST_STAFF_PROFILE_SELECT = {
  employee_id: true,
  staff_type: true,
  department_id: true,
  gender: true,
  date_joined: true,
} satisfies Prisma.StaffProfileSelect;

const USER_LIST_WITH_STAFF_DETAILS = {
  ...USER_SELECT,
  staff_profile: { select: USER_LIST_STAFF_PROFILE_SELECT },
} satisfies Prisma.UserSelect;

type UserListRowWithStaff = Prisma.UserGetPayload<{
  select: typeof USER_LIST_WITH_STAFF_DETAILS;
}>;

/** Returns user without nested profile objects to avoid duplicating id, tenantId, identifier, etc. */
function shapeUserByRole(user: UserWithProfiles): Record<string, unknown> {
  const { ...rest } = user;
  const base = { ...rest };
  PROFILE_KEYS.forEach((key) => delete base[key]);
  return base as Record<string, unknown>;
}

function shouldIncludeStudentListDetails(role: UserRole | undefined): boolean {
  return role == null || role === UserRole.STUDENT;
}

/** List row when student_profile (+ class) was loaded for students. */
function shapeUserListRowWithStudent(
  user: UserListRowWithStudent,
): Record<string, unknown> {
  const { student_profile, ...rest } = user;
  const base = shapeUserByRole(rest as UserWithProfiles);
  return {
    ...base,
    student_profile: student_profile
      ? {
          matric_number: student_profile.matric_number,
          class_id: student_profile.class_id,
          class: student_profile.class,
        }
      : null,
  };
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  // CREATE USER
  async create(dto: CreateUserDto, createdBy: { id: string; role: UserRole }) {
    const tenantId = this.cls.get<string>('tenantId');

    assertCanAssignUserRole(createdBy.role, dto.role);

    // Guardians and parents must provide identifier
    if (
      (dto.role === UserRole.GUARDIAN || dto.role === UserRole.PARENT) &&
      !dto.identifier?.trim()
    ) {
      throw new BadRequestException(
        'identifier is required for guardians and parents',
      );
    }

    if (dto.role === UserRole.GUARDIAN && !dto.relationship?.trim()) {
      throw new BadRequestException('relationship is required for guardians');
    }

    // Check the email is not already taken within this school (only when email is provided)
    const emailProvided = dto.email != null && dto.email.trim() !== '';
    if (emailProvided) {
      const existingEmail = await this.prisma.user.findFirst({
        where: { tenant_id: tenantId, email: dto.email!.trim() },
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
        where: { tenant_id: tenantId, identifier },
      });
      if (existingUser) {
        throw new IdentifierTakenException(identifier);
      }

      // Create the base user
      const newUser = await tx.user.create({
        data: {
          tenant_id: tenantId,
          role: dto.role,
          identifier,
          first_name: dto.first_name,
          last_name: dto.last_name,
          email: dto.email,
          phone: dto.phone,
          gender: dto.gender,
          password_hash: passwordHash,
          status: 'ACTIVE',
          ...(dto.role === UserRole.PARENT || dto.role === UserRole.GUARDIAN
            ? { relationship: dto.relationship?.trim() ?? null }
            : {}),
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

      if (dto.role === UserRole.PARENT || dto.role === UserRole.GUARDIAN) {
        await this.linkParentToStudentWards(
          tx,
          tenantId,
          newUser.id,
          dto.ward_ids,
        );
      }

      return newUser;
    });

    this.logger.log(
      `User '${user.identifier}' (${user.role}) created in school '${tenantId}' by '${createdBy.id}'`,
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
      tenant_id: tenantId,
      ...(role && { role }),
      ...(status && { status }),
      // Search across name, email, matric number, employee ID, guardian ID, or identifier
      ...(search && {
        OR: [
          { first_name: { contains: search, mode: 'insensitive' } },
          { last_name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { identifier: { contains: search, mode: 'insensitive' } },
          {
            student_profile: {
              is: {
                matric_number: { contains: search, mode: 'insensitive' },
              },
            },
          },
          {
            teacher_profile: {
              is: {
                employee_id: { contains: search, mode: 'insensitive' },
              },
            },
          },
          {
            guardian_profile: {
              is: {
                user_id: { contains: search, mode: 'insensitive' },
              },
            },
          },
        ],
      }),
    };

    // Filter students by classId when class_id is provided (only when role is not set or role is STUDENT)
    if (class_id && (!role || role === UserRole.STUDENT)) {
      where.role = UserRole.STUDENT;
      where.student_profile = { is: { class_id } };
    }

    const listSelect = shouldIncludeStudentListDetails(role)
      ? USER_LIST_WITH_STUDENT_DETAILS
      : USER_SELECT;

    // Run count and data fetch in parallel using Promise.all
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: listSelect,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return {
      data: shouldIncludeStudentListDetails(role)
        ? (users as UserListRowWithStudent[]).map((u) =>
            shapeUserListRowWithStudent(u),
          )
        : users.map((u) => shapeUserByRole(u)),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        has_next_page: page < Math.ceil(total / limit),
        has_previous_page: page > 1,
      },
    };
  }

  // Find all students
  async findAllStudents(dto: QueryUsersDto) {
    const tenantId = this.cls.get<string>('tenantId');
    const { page = 1, limit = 20, search, status, class_id } = dto;

    const where: Prisma.UserWhereInput = {
      tenant_id: tenantId,
      role: UserRole.STUDENT,
      ...(status && { status }),
      ...(search && {
        OR: [
          { first_name: { contains: search, mode: 'insensitive' } },
          { last_name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { identifier: { contains: search, mode: 'insensitive' } },
          {
            student_profile: {
              matric_number: { contains: search, mode: 'insensitive' },
            },
          },
        ],
      }),
      ...(class_id && {
        student_profile: { class_id },
      }),
    };

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          ...USER_SELECT,
          student_profile: {
            select: {
              matric_number: true,
              class_id: true,
              class: {
                select: {
                  id: true,
                  name: true,
                  level: true,
                  department_id: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      data: users.map((user) => ({
        ...shapeUserByRole(user as UserWithProfiles),
        student_profile: user.student_profile
          ? {
              matric_number: user.student_profile.matric_number,
              class_id: user.student_profile.class_id,
              class: user.student_profile.class,
            }
          : null,
      })),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        has_next_page: page < Math.ceil(total / limit),
        has_previous_page: page > 1,
      },
    };
  }

  // Find all teachers
  async findAllTeachers(dto: QueryTeachersDto) {
    const tenantId = this.cls.get<string>('tenantId');
    const {
      page = 1,
      limit = 20,
      search,
      status,
      qualification,
      class_of_degree,
      course_of_study,
      year_of_graduation,
    } = dto;

    const where: Prisma.UserWhereInput = {
      tenant_id: tenantId,
      role: UserRole.TEACHER,
      ...(status && { status }),
      ...(search && {
        OR: [
          { first_name: { contains: search, mode: 'insensitive' } },
          { last_name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { identifier: { contains: search, mode: 'insensitive' } },
          {
            teacher_profile: {
              employee_id: { contains: search, mode: 'insensitive' },
            },
          },
        ],
      }),
      teacher_profile: {
        ...(qualification && {
          qualification: { contains: qualification, mode: 'insensitive' },
        }),
        ...(class_of_degree && {
          class_of_degree: { contains: class_of_degree, mode: 'insensitive' },
        }),
        ...(course_of_study && {
          course_of_study: { contains: course_of_study, mode: 'insensitive' },
        }),
        ...(year_of_graduation && {
          year_of_graduation: {
            contains: year_of_graduation,
            mode: 'insensitive',
          },
        }),
      },
    };

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: USER_LIST_WITH_TEACHER_DETAILS,
      }),
    ]);

    return {
      data: (users as UserListRowWithTeacher[]).map((user) => ({
        ...shapeUserByRole(user as UserWithProfiles),
        identifier: user.identifier,
        teacher_profile: user.teacher_profile
          ? {
              staff_id: user.teacher_profile.employee_id ?? user.identifier,
              qualification: user.teacher_profile.qualification,
              class_of_degree: user.teacher_profile.class_of_degree,
              course_of_study: user.teacher_profile.course_of_study,
              graduation_year: user.teacher_profile.year_of_graduation,
            }
          : null,
      })),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        has_next_page: page < Math.ceil(total / limit),
        has_previous_page: page > 1,
      },
    };
  }

  // Parents / guardians (PARENT or GUARDIAN role)
  async findAllParents(dto: QueryParentsDto) {
    const tenantId = this.cls.get<string>('tenantId');
    const {
      page = 1,
      limit = 20,
      search,
      status,
      gender,
      occupation,
      relationship,
    } = dto;

    const guardianFilters: Prisma.GuardianProfileWhereInput = {
      ...(occupation && {
        occupation: { contains: occupation, mode: 'insensitive' },
      }),
      ...(relationship && {
        relationship: { contains: relationship, mode: 'insensitive' },
      }),
    };

    const hasGuardianFieldFilters = occupation != null || relationship != null;

    const where: Prisma.UserWhereInput = {
      tenant_id: tenantId,
      role: { in: [UserRole.PARENT, UserRole.GUARDIAN] },
      ...(status && { status }),
      ...(gender && { gender }),
      ...(hasGuardianFieldFilters && {
        guardian_profile: { is: guardianFilters },
      }),
      ...(search && {
        OR: [
          { first_name: { contains: search, mode: 'insensitive' } },
          { last_name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { identifier: { contains: search, mode: 'insensitive' } },
          {
            relationship: { contains: search, mode: 'insensitive' },
          },
          {
            guardian_profile: {
              is: {
                occupation: { contains: search, mode: 'insensitive' },
              },
            },
          },
          {
            guardian_profile: {
              is: {
                relationship: { contains: search, mode: 'insensitive' },
              },
            },
          },
        ],
      }),
    };

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: USER_LIST_WITH_GUARDIAN_DETAILS,
      }),
    ]);

    const wardIdSet = new Set<string>();
    for (const u of users as UserListRowWithGuardian[]) {
      for (const id of u.guardian_profile?.ward_ids ?? []) {
        if (id?.trim()) wardIdSet.add(id.trim());
      }
    }

    const wardUsers =
      wardIdSet.size > 0
        ? await this.prisma.user.findMany({
            where: {
              tenant_id: tenantId,
              role: UserRole.STUDENT,
              id: { in: [...wardIdSet] },
            },
            select: { id: true, first_name: true, last_name: true },
          })
        : [];

    const wardById = new Map(
      wardUsers.map((w) => [
        w.id,
        { id: w.id, first_name: w.first_name, last_name: w.last_name },
      ]),
    );

    const resolveWards = (wardIds: string[]) =>
      wardIds.map((wardUserId) => {
        const row = wardById.get(wardUserId);
        if (row) return row;
        return {
          id: wardUserId,
          first_name: null,
          last_name: null,
        };
      });

    return {
      data: (users as UserListRowWithGuardian[]).map((user) => ({
        ...shapeUserByRole(user as UserWithProfiles),
        guardian_profile: user.guardian_profile
          ? {
              occupation: user.guardian_profile.occupation,
              relationship:
                user.guardian_profile.relationship ?? user.relationship,
              wards: resolveWards(user.guardian_profile.ward_ids ?? []),
            }
          : null,
      })),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        has_next_page: page < Math.ceil(total / limit),
        has_previous_page: page > 1,
      },
    };
  }

  /**
   * Non-teaching staff: users with a staff_profile and role !== TEACHER.
   * Query params mirror teachers; filters map to staff_profile where possible:
   * qualification → staff_type (contains), class_of_degree → staff_type (contains),
   * course_of_study → department_id (exact), year_of_graduation → date_joined calendar year.
   */
  async findAllStaffExcludingTeachers(dto: QueryTeachersDto) {
    const tenantId = this.cls.get<string>('tenantId');
    const {
      page = 1,
      limit = 20,
      search,
      status,
      gender,
      qualification,
      class_of_degree,
      course_of_study,
      year_of_graduation,
    } = dto;

    const staffParts: Prisma.StaffProfileWhereInput[] = [];

    if (qualification?.trim()) {
      staffParts.push({
        staff_type: {
          contains: qualification.trim(),
          mode: 'insensitive',
        },
      });
    }
    if (class_of_degree?.trim()) {
      staffParts.push({
        staff_type: {
          contains: class_of_degree.trim(),
          mode: 'insensitive',
        },
      });
    }
    if (course_of_study?.trim()) {
      staffParts.push({ department_id: course_of_study.trim() });
    }
    if (year_of_graduation?.trim()) {
      const y = parseInt(year_of_graduation.trim(), 10);
      if (!Number.isNaN(y)) {
        staffParts.push({
          date_joined: {
            gte: new Date(Date.UTC(y, 0, 1)),
            lt: new Date(Date.UTC(y + 1, 0, 1)),
          },
        });
      }
    }

    const staffProfileIs: Prisma.StaffProfileWhereInput =
      staffParts.length > 0 ? { AND: staffParts } : {};

    const where: Prisma.UserWhereInput = {
      tenant_id: tenantId,
      role: { not: UserRole.TEACHER },
      ...(status && { status }),
      ...(gender && { gender }),
      staff_profile: { is: staffProfileIs },
      ...(search && {
        OR: [
          { first_name: { contains: search, mode: 'insensitive' } },
          { last_name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { identifier: { contains: search, mode: 'insensitive' } },
          {
            staff_profile: {
              is: {
                employee_id: { contains: search, mode: 'insensitive' },
              },
            },
          },
        ],
      }),
    };

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: USER_LIST_WITH_STAFF_DETAILS,
      }),
    ]);

    return {
      data: (users as UserListRowWithStaff[]).map((user) => ({
        ...shapeUserByRole(user as UserWithProfiles),
        identifier: user.identifier,
        staff_profile: user.staff_profile
          ? {
              staff_id: user.staff_profile.employee_id ?? user.identifier,
              staff_type: user.staff_profile.staff_type,
              department_id: user.staff_profile.department_id,
              gender: user.staff_profile.gender,
              date_joined: user.staff_profile.date_joined,
            }
          : null,
      })),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        has_next_page: page < Math.ceil(total / limit),
        has_previous_page: page > 1,
      },
    };
  }

  /** Internal: returns full user or throws. Use findOne for API (shaped) response. */
  private async getOneOrThrow(id: string): Promise<UserWithProfiles> {
    const tenantId = this.cls.get<string>('tenantId');
    const user = await this.prisma.user.findUnique({
      where: { id, tenant_id: tenantId },
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
        where: { tenant_id: tenantId, email: dto.email, NOT: { id } },
      });
      if (existingEmail) {
        throw new EmailTakenException(dto.email);
      }
    }

    // Split profile-only fields; map DTO snake_case to Prisma camelCase for base user
    const {
      qualification,
      course_of_study,
      class_of_degree,
      year_of_graduation,
      subject_ids,
      department_id,
      class_id,
      first_name,
      last_name,
      phone_number,
      ...rest
    } = dto;

    const baseUserData: Prisma.UserUpdateInput = {
      ...(first_name !== undefined && { first_name: first_name }),
      ...(last_name !== undefined && { last_name: last_name }),
      ...(phone_number !== undefined && { phone: phone_number }),
      ...(rest.email !== undefined && { email: rest.email }),
      ...(rest.avatar !== undefined && { avatar: rest.avatar }),
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id, tenant_id: tenantId },
        data: baseUserData,
      });

      if (
        qualification ||
        subject_ids ||
        department_id ||
        course_of_study ||
        class_of_degree ||
        year_of_graduation
      ) {
        await tx.teacherProfile.updateMany({
          where: { user_id: id },
          data: {
            ...(qualification !== undefined && { qualification }),
            ...(subject_ids !== undefined && { subject_ids: subject_ids }),
            ...(department_id !== undefined && {
              department_id: department_id,
            }),
            ...(course_of_study !== undefined && { course_of_study }),
            ...(class_of_degree !== undefined && { class_of_degree }),
            ...(year_of_graduation !== undefined && { year_of_graduation }),
          },
        });
      }

      if (class_id !== undefined) {
        await tx.studentProfile.updateMany({
          where: { user_id: id },
          data: { class_id: class_id },
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
      where: { id, tenant_id: tenantId },
      data: { status: UserStatus.SUSPENDED },
    });

    // Invalidate all their refresh tokens and revoke all their tokens
    await this.prisma.refreshToken.deleteMany({
      where: { user_id: id },
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
      where: { id, tenant_id: tenantId },
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
      where: { id: userId, tenant_id: tenantId },
    });

    const isCurrentPasswordValid = await bcrypt.compare(
      dto.current_password,
      user?.password_hash ?? '',
    );

    if (!isCurrentPasswordValid) {
      throw new IncorrectPasswordException();
    }

    if (dto.new_password === dto.current_password) {
      throw new PasswordSameAsOldException();
    }

    const newHash = await bcrypt.hash(dto.new_password, 12);

    await this.prisma.user.update({
      where: { id: userId, tenant_id: tenantId },
      data: { password_hash: newHash },
    });

    await this.prisma.refreshToken.deleteMany({
      where: { user_id: userId },
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
      data: { password_hash: newHash },
    });

    await this.prisma.refreshToken.deleteMany({
      where: { user_id: targetUserId },
    });

    this.logger.log(
      `Password reset for user '${targetUserId}' by admin '${adminId}'`,
    );

    return { message: 'Password reset successfully. Please login again.' };
  }

  // Bulk Upload Users from CSV
  async bulkImport(fileBuffer: Buffer, role: UserRole, creatorRole: UserRole) {
    const tenantId = this.cls.get<string>('tenantId');

    assertCanAssignUserRole(creatorRole, role);
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
          where: { tenant_id: tenantId, identifier: row.identifier },
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
              tenant_id: tenantId,
              role,
              identifier,
              first_name: row.first_name,
              last_name: row.last_name,
              email: row.email || null,
              phone: row.phone || null,
              password_hash: password,
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

    // TODO: Add performance metrics for each query
    // Count all roles in parallel
    const [
      studentCount,
      teacherCount,
      guardianCount,
      staffCount,
      classCount,
      // activeCount,
      // suspendedCount,
      // deletedCount,
    ] = await Promise.all([
      this.prisma.user.count({
        where: { tenant_id: tenantId, role: UserRole.STUDENT },
      }),
      this.prisma.user.count({
        where: { tenant_id: tenantId, role: UserRole.TEACHER },
      }),
      this.prisma.user.count({
        where: { tenant_id: tenantId, role: UserRole.GUARDIAN },
      }),
      this.prisma.user.count({
        where: {
          tenant_id: tenantId,
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
      this.prisma.class.count({
        where: { tenant_id: tenantId },
      }),
      // this.prisma.user.count({
      //   where: { tenant_id: tenantId, status: UserStatus.ACTIVE },
      // }),
      // this.prisma.user.count({
      //   where: { tenant_id: tenantId, status: UserStatus.SUSPENDED },
      // }),
      // this.prisma.user.count({
      //   where: { tenant_id: tenantId, status: UserStatus.DELETED },
      // }),
    ]);

    return {
      total_students: studentCount,
      total_teachers: teacherCount,
      total_parents: guardianCount,
      total_staff: staffCount,
      total_classes: classCount,
      // total_active: activeCount,
      // total_suspended: suspendedCount,
      // total_deleted: deletedCount,
      // total: studentCount + teacherCount + guardianCount + staffCount,
    };
  }

  // // Get Class Distribution Statistics by Level
  // async getClassDistributionStats() {
  //   const tenantId = this.cls.get<string>('tenantId');
  //   const [classCount, studentCount] = await Promise.all([
  //     this.prisma.class.count({
  //       where: { tenant_id: tenantId },
  //     }),
  //     this.prisma.studentProfile.count({
  //       where: { tenant_id: tenantId },
  //     }),
  //   ]);
  //   return { total_classes: classCount, total_students: studentCount };
  // }

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

    // GUARDIAN / PARENT: identifier required (validated in create())
    if (dto.role === UserRole.GUARDIAN || dto.role === UserRole.PARENT) {
      const identifier = dto.identifier?.trim();
      if (!identifier) {
        throw new BadRequestException(
          'identifier is required for guardians and parents',
        );
      }
      return { identifier };
    }

    // Other roles (e.g. school admin): require explicit identifier
    const fallbackIdentifier = dto.identifier?.trim();
    if (!fallbackIdentifier) {
      throw new BadRequestException('identifier is required');
    }
    return { identifier: fallbackIdentifier };
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
      where: {
        tenant_id: tenantId,
        matric_number: { startsWith: matricPrefix },
      },
      orderBy: { matric_number: 'desc' },
      select: { matric_number: true },
    });
    const numPart = last
      ? String(last.matric_number).slice(matricPrefix.length)
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
      where: { tenant_id: tenantId, employee_id: { startsWith: empPrefix } },
      orderBy: { employee_id: 'desc' },
      select: { employee_id: true },
    });
    const numPart = last
      ? String(last.employee_id).slice(empPrefix.length)
      : '';
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
      where: { tenant_id: tenantId, employee_id: { startsWith: empPrefix } },
      orderBy: { employee_id: 'desc' },
      select: { employee_id: true },
    });
    const numPart = last
      ? String(last.employee_id).slice(empPrefix.length)
      : '';
    const nextNum = numPart ? parseInt(numPart, 10) + 1 : 1;
    return `${empPrefix}${String(nextNum).padStart(3, '0')}`;
  }

  /**
   * Writes each student’s guardian_ids to this parent’s user id.
   * At most one parent/guardian per student; throws if the student is already linked to someone else.
   */
  private async linkParentToStudentWards(
    tx: Prisma.TransactionClient,
    tenantId: string,
    parentUserId: string,
    wardIds: string[] | undefined,
  ): Promise<void> {
    if (!wardIds?.length) return;

    const uniqueWardIds = [
      ...new Set(wardIds.map((id) => id?.trim()).filter(Boolean)),
    ] as string[];

    for (const studentUserId of uniqueWardIds) {
      const studentUser = await tx.user.findFirst({
        where: {
          id: studentUserId,
          tenant_id: tenantId,
          role: UserRole.STUDENT,
        },
        select: { id: true },
      });
      if (!studentUser) {
        throw new BadRequestException(
          `Ward "${studentUserId}" is not a student in this school.`,
        );
      }

      const profile = await tx.studentProfile.findUnique({
        where: { user_id: studentUserId },
        select: { guardian_ids: true },
      });
      if (!profile) {
        throw new BadRequestException(
          `Student profile is missing for ward "${studentUserId}".`,
        );
      }

      const current = profile.guardian_ids ?? [];
      if (current.length === 0) {
        await tx.studentProfile.update({
          where: { user_id: studentUserId },
          data: { guardian_ids: [parentUserId] },
        });
        continue;
      }
      if (current.length === 1 && current[0] === parentUserId) {
        continue;
      }

      throw new ConflictException(
        'Each student may have only one parent/guardian account; this student is already linked to another parent.',
      );
    }
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
            user_id: userId,
            tenant_id: tenantId,
            matric_number: resolved.matricNumber ?? resolved.identifier,
            class_id: dto.class_id ?? '',
            admission_date: dto.admission_date
              ? new Date(dto.admission_date)
              : null,
            date_of_birth: dto.date_of_birth
              ? new Date(dto.date_of_birth)
              : null,
            gender: dto.gender,
          },
        });
        break;

      case UserRole.TEACHER:
        await tx.teacherProfile.create({
          data: {
            user_id: userId,
            tenant_id: tenantId,
            employee_id: resolved.employeeId ?? resolved.identifier,
            qualification: dto.qualification ?? null,
            course_of_study: dto.course_of_study ?? null,
            class_of_degree: dto.class_of_degree ?? null,
            year_of_graduation:
              dto.year_of_graduation ?? dto.graduation_date ?? null,
            assigned_subject_ids: dto.subject_ids ?? [],
          },
        });
        break;

      case UserRole.PARENT:
      case UserRole.GUARDIAN:
        await tx.guardianProfile.create({
          data: {
            user_id: userId,
            tenant_id: tenantId,
            occupation: dto.occupation?.trim() || null,
            relationship: dto.relationship?.trim() || null,
            ward_ids: dto.ward_ids ?? [],
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
            user_id: userId,
            tenant_id: tenantId,
            employee_id: resolved.employeeId ?? resolved.identifier,
            staff_type: dto.staff_type ?? dto.role.toLowerCase(),
            gender: dto.gender,
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
