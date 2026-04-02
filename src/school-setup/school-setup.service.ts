import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from 'src/database/prisma.service';
import {
  ActiveTermRequiredException,
  CompulsorySubjectCannotDeregisterException,
  StudentAlreadyInClassException,
  StudentNotInClassException,
  SubjectAlreadyAssignedException,
  SubjectCodeTakenException,
  SubjectNotAssignedException,
  TeacherAlreadyAssignedToSubjectException,
  UserNotFoundException,
} from 'src/errors/exceptions/business.exception';
import { SubjectType } from 'src/generated/prisma/enums';
import {
  CreateAcademicSessionDto,
  UpdateAcademicSessionDto,
} from './dto/academic-session.dto';
import {
  AssignSubjectToClassDto,
  BulkAssignSubjectsDto,
  BulkAssignTeachersDto,
  RegisterSubjectsDto,
  UpdateSubjectRegistrationDto,
} from './dto/class-subject.dto';
import { CreateClassDto, UpdateClassDto } from './dto/class.dto';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/subject.dto';
import { CreateTermDto, UpdateTermDto } from './dto/term.dto';
import { AppException } from 'src/errors/exceptions/app.exception';
import { ErrorCode } from 'src/errors/types/error-codes.enum';
import { BulkAssignStudentsDto } from './dto/assign-student.dto';

@Injectable()
export class SchoolSetupService {
  private readonly logger = new Logger(SchoolSetupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  // Academic sessions
  // Create Academic Session
  async createAcademicSession(dto: CreateAcademicSessionDto) {
    const tenantId = this.cls.get<string>('tenantId');
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    if (new Date(dto.start_date) >= new Date(dto.end_date)) {
      throw new BadRequestException('Start date must be before end date');
    }

    const existingSession = await this.prisma.academicSession.findFirst({
      where: {
        tenant_id: tenantId,
        name: dto.name,
      },
    });

    if (existingSession) {
      throw new ConflictException(
        `Academic session '${dto.name}' already exists`,
      );
    }

    // Only one session can be current at a time
    if (dto.is_current) {
      await this.prisma.academicSession.updateMany({
        where: {
          tenant_id: tenantId,
          is_current: true,
        },
        data: {
          is_current: false,
        },
      });
    }

    const academicSession = await this.prisma.academicSession.create({
      data: {
        tenant_id: tenantId,
        name: dto.name,
        start_date: new Date(dto.start_date),
        end_date: new Date(dto.end_date),
        is_current: dto.is_current ?? false,
      },
      include: {
        terms: true,
      },
    });

    this.logger.log(
      `Academic session '${dto.name}' created successfully with ID: ${academicSession.id} in school '${tenantId}'`,
    );
    return academicSession;
  }

  // Fetch all academic sessions
  async getAcademicSessions() {
    const tenantId = this.cls.get<string>('tenantId');

    return this.prisma.academicSession.findMany({
      where: { tenant_id: tenantId },
      include: {
        terms: {
          orderBy: { start_date: 'asc' },
        },
      },
      orderBy: { start_date: 'desc' },
    });
  }

  // Get current academic session
  async getCurrentAcademicSession() {
    const tenantId = this.cls.get<string>('tenantId');

    const currentSession = await this.prisma.academicSession.findFirst({
      where: { tenant_id: tenantId, is_current: true },
      include: {
        terms: {
          orderBy: { start_date: 'asc' },
        },
      },
    });

    if (!currentSession) {
      throw new NotFoundException('No current academic session found');
    }

    return currentSession;
  }

  // Mark academic session as current
  async markAcademicSessionAsCurrent(sessionId: string) {
    const tenantId = this.cls.get<string>('tenantId');

    await this.validateAcademicSessionBelongsToTenant(sessionId, tenantId);

    await this.prisma.$transaction([
      this.prisma.academicSession.updateMany({
        where: { tenant_id: tenantId, is_current: true },
        data: { is_current: false },
      }),
      this.prisma.academicSession.update({
        where: { id: sessionId },
        data: { is_current: true },
      }),
    ]);

    return this.prisma.academicSession.findUnique({
      where: { id: sessionId },
      include: { terms: true },
    });
  }

  // Update academic session
  async updateAcademicSession(
    sessionId: string,
    dto: UpdateAcademicSessionDto,
  ) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.validateAcademicSessionBelongsToTenant(sessionId, tenantId);

    if (dto.start_date && dto.end_date) {
      if (new Date(dto.start_date) >= new Date(dto.end_date)) {
        throw new BadRequestException('Start date must be before end date');
      }
    }

    return this.prisma.academicSession.update({
      where: { id: sessionId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.start_date && { startDate: new Date(dto.start_date) }),
        ...(dto.end_date && { endDate: new Date(dto.end_date) }),
      },
      include: { terms: true },
    });
  }

  // Delete academic session
  async deleteAcademicSession(sessionId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    const academicSession = await this.validateAcademicSessionBelongsToTenant(
      sessionId,
      tenantId,
    );

    if (academicSession.is_current) {
      throw new BadRequestException('Cannot delete current academic session');
    }

    // TODO: Uncomment this when we have results
    // const termsIds = academicSession.terms.map((term) => term.id);
    // if (termsIds.length > 0) {
    //   const linkedResults = await this.prisma.result.count({
    //     where: { id: { in: termsIds } },
    //   });
    //   if (linkedResults > 0) {
    //     throw new BadRequestException(
    //       'Cannot delete academic session, it has linked terms and students have results. Archive it instead.',
    //     );
    //   }
    // }

    await this.prisma.academicSession.delete({
      where: { id: sessionId },
    });
    return {
      message: 'Academic session deleted successfully',
    };
  }

  // Academic terms
  // Create academic term
  async createTerm(dto: CreateTermDto) {
    const tenantId = this.cls.get<string>('tenantId');

    await this.validateAcademicSessionBelongsToTenant(
      dto.academic_session_id,
      tenantId,
    );

    if (new Date(dto.start_date) >= new Date(dto.end_date)) {
      throw new BadRequestException('Start date must be before end date');
    }

    const existingTerm = await this.prisma.academicTerm.findFirst({
      where: { academic_session_id: dto.academic_session_id, name: dto.name },
    });

    if (existingTerm) {
      throw new ConflictException(
        `Term '${dto.name}' already exists in this session`,
      );
    }

    // Enforce max 3 terms per session
    const termsCount = await this.prisma.academicTerm.count({
      where: { academic_session_id: dto.academic_session_id },
    });
    if (termsCount >= 3) {
      throw new BadRequestException(
        'Cannot create more than 3 terms per session',
      );
    }

    // Only one term can be current at a time
    if (dto.is_current) {
      await this.prisma.academicTerm.updateMany({
        where: { tenant_id: tenantId, is_current: true },
        data: { is_current: false },
      });
    }

    return this.prisma.academicTerm.create({
      data: {
        tenant_id: tenantId,
        academic_session_id: dto.academic_session_id,
        name: dto.name,
        start_date: new Date(dto.start_date),
        end_date: new Date(dto.end_date),
        is_current: dto.is_current ?? false,
      },
    });
  }

  // Get Terms by academic session
  async getTermsByAcademicSession(academicSessionId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.validateAcademicSessionBelongsToTenant(
      academicSessionId,
      tenantId,
    );

    return this.prisma.academicTerm.findMany({
      where: { academic_session_id: academicSessionId, tenant_id: tenantId },
      orderBy: { start_date: 'asc' },
    });
  }

  // Get current term
  async getCurrentTerm() {
    const tenantId = this.cls.get<string>('tenantId');

    const term = await this.prisma.academicTerm.findFirst({
      where: { tenant_id: tenantId, is_current: true },
      include: { academicSession: true },
    });

    if (!term) {
      throw new NotFoundException('No current term found');
    }

    return term;
  }

  // Set term as current
  async setCurrentTerm(termId: string) {
    const tenantId = this.cls.get<string>('tenantId');

    await this.validateAcademicTermBelongsToTenant(termId, tenantId);

    await this.prisma.$transaction([
      this.prisma.academicTerm.updateMany({
        where: { tenant_id: tenantId, is_current: true },
        data: { is_current: false },
      }),
      this.prisma.academicTerm.update({
        where: { id: termId },
        data: { is_current: true },
      }),
    ]);

    return this.prisma.academicTerm.findUnique({
      where: { id: termId },
      include: { academicSession: true },
    });
  }

  // Update academic term
  async updateTerm(termId: string, dto: UpdateTermDto) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.validateAcademicTermBelongsToTenant(termId, tenantId);

    return this.prisma.academicTerm.update({
      where: { id: termId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.start_date && { start_date: new Date(dto.start_date) }),
        ...(dto.end_date && { end_date: new Date(dto.end_date) }),
      },
      include: { academicSession: true },
    });
  }

  // Departments
  // Create department
  async createDepartment(dto: CreateDepartmentDto) {
    const tenantId = this.cls.get<string>('tenantId');

    const existingDepartment = await this.prisma.department.findFirst({
      where: { tenant_id: tenantId, name: dto.name },
    });

    if (existingDepartment) {
      throw new ConflictException(
        `Department '${dto.name}' already exists in this school`,
      );
    }

    if (dto.hod_id) {
      await this.validateTeacherBelongsToTenant(dto.hod_id, tenantId);
      await this.assertHodNotDuplicatedAcrossDepartments(tenantId, dto.hod_id);
      await this.assertTeacherProfileClearForNewHodAppointment(
        tenantId,
        dto.hod_id,
      );
    }

    return this.prisma.department.create({
      data: {
        tenant_id: tenantId,
        ...dto,
      },
    });
  }

  // Get all departments
  async getDepartments() {
    const tenantId = this.cls.get<string>('tenantId');

    const departments = await this.prisma.department.findMany({
      where: { tenant_id: tenantId },
      include: {
        subjects: { select: { id: true, name: true, code: true } },
        classes: { select: { id: true, name: true, level: true } },
      },
      orderBy: { name: 'asc' },
    });

    const hodIds = [
      ...new Set(
        departments
          .map((d) => d.hod_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const hodUsers =
      hodIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: hodIds }, tenant_id: tenantId },
            select: { id: true, first_name: true, last_name: true },
          })
        : [];

    const hodById = new Map(hodUsers.map((u) => [u.id, u]));

    return departments.map((d) => {
      const hodUser = d.hod_id ? hodById.get(d.hod_id) : undefined;
      return {
        ...d,
        hod: hodUser
          ? {
              user_id: hodUser.id,
              first_name: hodUser.first_name,
              last_name: hodUser.last_name,
            }
          : null,
      };
    });
  }

  // Update department
  async updateDepartment(departmentId: string, dto: UpdateDepartmentDto) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.validateDepartmentBelongsToTenant(departmentId, tenantId);

    if (dto.hod_id) {
      await this.validateTeacherBelongsToTenant(dto.hod_id, tenantId);
      await this.assertHodNotDuplicatedAcrossDepartments(
        tenantId,
        dto.hod_id,
        departmentId,
      );
      await this.assertTeacherProfileDepartmentMatchesHodDepartment(
        tenantId,
        dto.hod_id,
        departmentId,
      );
    }

    return this.prisma.department.update({
      where: { id: departmentId },
      data: {
        name: dto.name,
        description: dto.description,
        hod_id: dto.hod_id,
      },
    });
  }

  // Delete department
  async deleteDepartment(departmentId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.validateDepartmentBelongsToTenant(departmentId, tenantId);

    // Nullify references rather than blocking deletion
    await this.prisma.$transaction([
      this.prisma.subject.updateMany({
        where: { department_id: departmentId },
        data: { department_id: null },
      }),
      this.prisma.class.updateMany({
        where: { department_id: departmentId },
        data: { department_id: null },
      }),
      this.prisma.department.delete({
        where: { id: departmentId },
      }),
    ]);

    return { message: 'Department deleted successfully' };
  }

  // Classes
  // Create class
  async createClass(dto: CreateClassDto) {
    const tenantId = this.cls.get<string>('tenantId');

    const existingClass = await this.prisma.class.findFirst({
      where: { tenant_id: tenantId, name: dto.name },
    });
    if (existingClass) {
      throw new ConflictException(
        `Class '${dto.name}' already exists in this school`,
      );
    }

    if (dto.department_id) {
      await this.validateDepartmentBelongsToTenant(dto.department_id, tenantId);
    }

    if (dto.class_teacher_id) {
      await this.validateTeacherBelongsToTenant(dto.class_teacher_id, tenantId);
    }

    return this.prisma.class.create({
      data: {
        tenant_id: tenantId,
        name: dto.name,
        level: dto.level,
        capacity: dto.capacity ?? 0,
        department_id: dto.department_id ?? null,
        class_teacher_id: dto.class_teacher_id ?? null,
      },
      include: {
        department: true,
        class_subjects: { include: { subject: true } },
      },
    });
  }

  // get all classes
  async getClasses(level?: string) {
    const tenantId = this.cls.get<string>('tenantId');

    const classes = await this.prisma.class.findMany({
      where: { tenant_id: tenantId, ...(level && { level }) },
      include: {
        department: { select: { id: true, name: true } },
        class_subjects: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
          },
        },
        students: {
          include: {
            user: { select: { id: true, first_name: true, last_name: true } },
          },
          orderBy: { matric_number: 'asc' },
        },
        _count: { select: { students: true, class_subjects: true } },
      },
      orderBy: [{ name: 'asc' }, { level: 'asc' }],
    });

    const teacherIds = [
      ...new Set(
        classes
          .map((c) => c.class_teacher_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const teachers =
      teacherIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: teacherIds }, tenant_id: tenantId },
            select: { id: true, first_name: true, last_name: true },
          })
        : [];

    const teacherById = new Map(teachers.map((t) => [t.id, t]));

    return classes.map((c) => {
      const { students, _count, subject_ids, ...rest } = c;
      void subject_ids;
      const teacher = c.class_teacher_id
        ? teacherById.get(c.class_teacher_id)
        : undefined;

      return {
        ...rest,
        class_teacher: teacher
          ? {
              user_id: teacher.id,
              first_name: teacher.first_name,
              last_name: teacher.last_name,
            }
          : null,
        students: students.map((s) => ({
          user_id: s.user_id,
          first_name: s.user.first_name,
          last_name: s.user.last_name,
          matric_number: s.matric_number,
        })),
        student_count: _count.students,
        subject_count: _count.class_subjects,
      };
    });
  }

  // Get classes with just id and the name of the class
  async getClassesWithIdAndName() {
    const tenantId = this.cls.get<string>('tenantId');
    return this.prisma.class.findMany({
      where: { tenant_id: tenantId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  // Get class by id
  async getClassById(classId: string) {
    const tenantId = this.cls.get<string>('tenantId');

    const cls = await this.prisma.class.findUnique({
      where: { id: classId, tenant_id: tenantId },
      include: {
        department: { select: { id: true, name: true } },
        class_subjects: {
          include: {
            subject: {
              select: {
                id: true,
                name: true,
                code: true,
                title: true,
                description: true,
                department: { select: { id: true, name: true } },
              },
            },
          },
        },
        students: {
          include: {
            user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
                avatar: true,
                identifier: true,
              },
            },
          },
          orderBy: { matric_number: 'asc' },
        },
        _count: { select: { students: true, class_subjects: true } },
      },
    });

    if (!cls) {
      throw new NotFoundException('Class not found');
    }

    const classTeacher = cls.class_teacher_id
      ? await this.prisma.user.findFirst({
          where: {
            id: cls.class_teacher_id,
            tenant_id: tenantId,
          },
          select: { id: true, first_name: true, last_name: true },
        })
      : null;

    const registeredSubjectIds = [
      ...new Set(
        cls.students.flatMap((student) => student.registered_subject_ids),
      ),
    ];

    const registeredSubjects =
      registeredSubjectIds.length > 0
        ? await this.prisma.subject.findMany({
            where: {
              tenant_id: tenantId,
              id: { in: registeredSubjectIds },
            },
            select: {
              id: true,
              name: true,
              code: true,
              title: true,
              department: { select: { id: true, name: true } },
            },
          })
        : [];

    const registeredSubjectById = new Map(
      registeredSubjects.map((subject) => [subject.id, subject]),
    );

    const {
      _count,
      students,
      class_subjects,
      class_teacher_id,
      subject_ids,
      department_id,
      ...classBase
    } = cls;
    void class_teacher_id;
    void subject_ids;
    void department_id;

    return {
      ...classBase,
      class_teacher: classTeacher
        ? {
            user_id: classTeacher.id,
            first_name: classTeacher.first_name,
            last_name: classTeacher.last_name,
          }
        : null,
      class_subjects: class_subjects.map((classSubject) => ({
        id: classSubject.id,
        subject_id: classSubject.subject_id,
        subject_type: classSubject.subject_type,
        name: classSubject.subject.name,
        code: classSubject.subject.code,
        title: classSubject.subject.title,
        description: classSubject.subject.description,
        department: classSubject.subject.department,
      })),
      students: students.map((student) => ({
        user_id: student.user_id,
        gender: student.gender,
        first_name: student.user.first_name,
        last_name: student.user.last_name,
        matric_number: student.matric_number,
        avatar: student.user.avatar,
        email: student.user.email,
        registered_subjects: student.registered_subject_ids
          .map((subjectId) => registeredSubjectById.get(subjectId))
          .filter(
            (
              subject,
            ): subject is {
              id: string;
              name: string;
              code: string;
              title: string;
              department: { id: string; name: string } | null;
            } => Boolean(subject),
          )
          .map((subject) => ({
            id: subject.id,
            name: subject.name,
            code: subject.code,
            title: subject.title,
            department: subject.department,
          })),
      })),
      student_count: _count.students,
      subject_count: _count.class_subjects,
    };
  }

  // Update class
  async updateClass(classId: string, dto: UpdateClassDto) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.validateClassBelongsToTenant(classId, tenantId);

    if (dto.department_id) {
      await this.validateDepartmentBelongsToTenant(dto.department_id, tenantId);
    }

    if (dto.class_teacher_id) {
      await this.validateTeacherBelongsToTenant(dto.class_teacher_id, tenantId);
    }

    if (dto.name) {
      const existingClass = await this.prisma.class.findFirst({
        where: { tenant_id: tenantId, name: dto.name, NOT: { id: classId } },
      });
      if (existingClass) {
        throw new ConflictException(
          `Class '${dto.name}' already exists in this school`,
        );
      }
    }

    return this.prisma.class.update({
      where: { id: classId },
      data: {
        name: dto.name,
        level: dto.level,
        capacity: dto.capacity ?? 0,
        department_id: dto.department_id ?? null,
        class_teacher_id: dto.class_teacher_id ?? null,
      },
      include: {
        department: true,
        class_subjects: { include: { subject: true } },
      },
    });
  }

  // Delete class
  async deleteClass(classId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.validateClassBelongsToTenant(classId, tenantId);

    // Prevent deletion if class has students
    const studentsCount = await this.prisma.studentProfile.count({
      where: { class_id: classId },
    });
    if (studentsCount > 0) {
      throw new BadRequestException(
        `Cannot delete class, it has ${studentsCount} students. Move them to another class before deleting.`,
      );
    }

    await this.prisma.class.delete({
      where: { id: classId },
    });
    return { message: 'Class deleted successfully' };
  }

  // Bulk Assign students to class
  async bulkAssignStudentsToClass(dto: BulkAssignStudentsDto, classId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    const cls = await this.validateClassBelongsToTenant(classId, tenantId);

    // Check if class is full
    const currentCount = await this.prisma.studentProfile.count({
      where: { class_id: classId },
    });
    const availableSeats = cls.capacity - currentCount;

    if (availableSeats < dto.student_user_ids.length) {
      throw new AppException({
        code: ErrorCode.RESOURCE_CONFLICT,
        statusCode: 400,
        message: `Class '${cls.name}' has only ${availableSeats} available seats. but you are trying to assign ${dto.student_user_ids.length} student(s).`,
        action:
          'Reduce the number of students to assign or assign the students to a different class.',
      });
    }

    const results = {
      assigned: [] as string[],
      skipped: [] as { studentUserId: string; reason: string }[],
    };

    for (const studentUserId of dto.student_user_ids) {
      try {
        const studentProfile = await this.prisma.studentProfile.findFirst({
          where: { tenant_id: tenantId, user_id: studentUserId },
          include: { class: true },
        });

        if (!studentProfile) {
          results.skipped.push({ studentUserId, reason: 'Student not found' });
          continue;
        }

        if (studentProfile.class_id === classId) {
          results.skipped.push({
            studentUserId,
            reason: 'Student already in this class',
          });
          continue;
        }

        await this.prisma.studentProfile.update({
          where: { id: studentProfile.id },
          data: { class_id: classId },
        });

        results.assigned.push(studentUserId);
      } catch (error) {
        results.skipped.push({
          studentUserId,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      message: `Successfully assigned ${results.assigned.length} student(s) to ${cls.name} and skipped ${results.skipped.length} student(s)`,
      assigned: results.assigned,
      skipped: results.skipped,
    };
  }

  // Assign student in class
  async assignStudentToClass(classId: string, studentUserId: string) {
    const tenantId = this.cls.get<string>('tenantId');

    // Verify the class exists in this school
    const cls = await this.validateClassBelongsToTenant(classId, tenantId);

    // Verify the student exists in this school
    const studentProfile = await this.prisma.studentProfile.findFirst({
      where: { tenant_id: tenantId, user_id: studentUserId },
      include: { class: true },
    });
    if (!studentProfile) throw new UserNotFoundException();

    // Block if already in this exact class
    if (studentProfile.class_id === classId) {
      throw new StudentAlreadyInClassException(cls.name);
    }

    // Block if already in a different class — use transfer instead
    if (studentProfile.class_id && studentProfile.class_id !== classId) {
      throw new StudentAlreadyInClassException(
        studentProfile.class?.name ?? 'another class',
      );
    }

    // Check class capacity
    const currentCount = await this.prisma.studentProfile.count({
      where: { class_id: classId },
    });

    if (currentCount >= cls.capacity) {
      throw new AppException({
        code: ErrorCode.RESOURCE_CONFLICT,
        statusCode: 400,
        message: `Class '${cls.name}' is at full capacity (${cls.capacity} students).`,
        action:
          'Increase the class capacity or assign the student to a different class.',
      });
    }

    await this.prisma.studentProfile.update({
      where: { id: studentProfile.id },
      data: { class_id: classId },
    });

    this.logger.log(
      `Student '${studentUserId}' assigned to class '${cls.name}' in tenant '${tenantId}'`,
    );

    return {
      message: `Student successfully assigned to ${cls.name}`,
      student_id: studentProfile.id,
      class_id: classId,
      className: cls.name,
    };
  }

  // Transfer student from one class to another
  async transferStudentToClass(
    destinationClassId: string,
    studentUserId: string,
    reason?: string,
  ) {
    const tenantId = this.cls.get<string>('tenantId');
    const destinationClass = await this.validateClassBelongsToTenant(
      destinationClassId,
      tenantId,
    );

    const studentProfile = await this.prisma.studentProfile.findFirst({
      where: { tenant_id: tenantId, user_id: studentUserId },
      include: { class: true },
    });

    if (!studentProfile) throw new UserNotFoundException();

    if (studentProfile.class_id === destinationClassId) {
      throw new StudentAlreadyInClassException(destinationClass.name);
    }

    // Check if destination class is full
    const currentCount = await this.prisma.studentProfile.count({
      where: { class_id: destinationClassId },
    });
    if (currentCount >= destinationClass.capacity) {
      throw new AppException({
        code: ErrorCode.RESOURCE_CONFLICT,
        statusCode: 400,
        message: `Destination class '${destinationClass.name}' is at full capacity (${destinationClass.capacity} students).`,
        action:
          'Increase the class capacity or transfer the student to a different class.',
      });
    }

    const previousClass =
      (studentProfile.class as { name: string })?.name ?? 'unassigned';

    await this.prisma.studentProfile.update({
      where: { id: studentProfile.id },
      data: { class_id: destinationClassId },
    });

    this.logger.log(
      `Student '${studentUserId}' transferred from ${previousClass} to ${destinationClass.name} in tenant '${tenantId}. Reason: ${reason ?? 'not provided'}`,
    );

    return {
      message: `Student successfully transferred to ${destinationClass.name}`,
      student_id: studentProfile.id,
      class_id: destinationClassId,
      className: destinationClass.name,
    };
  }

  // TODO: This is not working, I got P2003
  // Remove student from class
  async removeStudentFromClass(studentUserId: string) {
    const tenantId = this.cls.get<string>('tenantId');

    const studentProfile = await this.prisma.studentProfile.findFirst({
      where: { tenant_id: tenantId, user_id: studentUserId },
    });
    if (!studentProfile) throw new UserNotFoundException();

    if (!studentProfile.class_id) {
      throw new AppException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        statusCode: 400,
        message: 'This student is not currently assigned to any class.',
      });
    }

    await this.prisma.studentProfile.update({
      where: { id: studentProfile.id },
      data: { class_id: null },
    });

    return { message: 'Student removed from class successfully' };
  }

  // Subjects
  // Create subject
  // BUG: SUbject with the same name can be created in the same department and the same school but different code because SS1-SS3 offers the same subject with different codes.
  async createSubject(dto: CreateSubjectDto) {
    const tenantId = this.cls.get<string>('tenantId');

    if (dto.department_id) {
      await this.validateDepartmentBelongsToTenant(dto.department_id, tenantId);
    }

    const codeExists = await this.prisma.subject.findFirst({
      where: {
        tenant_id: tenantId,
        code: dto.code,
        department_id: dto.department_id ?? null,
      },
    });
    if (codeExists) {
      throw new SubjectCodeTakenException(dto.code);
    }

    return this.prisma.subject.create({
      data: {
        tenant_id: tenantId,
        name: dto.name,
        title: dto.title,
        code: dto.code,
        description: dto.description,
        department_id: dto.department_id ?? null,
      },
      include: { department: true },
    });
  }

  // Get subjects by department
  async getSubjects(departmentId?: string) {
    const tenantId = this.cls.get<string>('tenantId');

    const subjects = await this.prisma.subject.findMany({
      where: {
        tenant_id: tenantId,
        ...(departmentId && { department_id: departmentId }),
      },
      include: {
        department: { select: { id: true, name: true } },
        class_subjects: {
          include: {
            class: { select: { id: true, name: true, level: true } },
            teachers: { select: { teacher_id: true } },
          },
        },
      },
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
    });

    const teacherIds = [
      ...new Set(
        subjects
          .flatMap((subject) =>
            subject.class_subjects.flatMap((classSubject) =>
              classSubject.teachers.map((teacher) => teacher.teacher_id),
            ),
          )
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const teachers =
      teacherIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: teacherIds }, tenant_id: tenantId },
            select: { id: true, first_name: true, last_name: true },
          })
        : [];

    const teacherById = new Map(
      teachers.map((teacher) => [teacher.id, teacher]),
    );

    return subjects.map((subject) => {
      const classesAssigned = [
        ...new Map(
          subject.class_subjects.map((classSubject) => [
            classSubject.class.id,
            {
              id: classSubject.class.id,
              name: classSubject.class.name,
              level: classSubject.class.level,
            },
          ]),
        ).values(),
      ];

      const teacherIdsForSubject = [
        ...new Set(
          subject.class_subjects.flatMap((classSubject) =>
            classSubject.teachers.map((teacher) => teacher.teacher_id),
          ),
        ),
      ];

      const teachersAssigned = teacherIdsForSubject
        .map((teacherId) => teacherById.get(teacherId))
        .filter(
          (
            teacher,
          ): teacher is { id: string; first_name: string; last_name: string } =>
            Boolean(teacher),
        )
        .map((teacher) => ({
          user_id: teacher.id,
          first_name: teacher.first_name,
          last_name: teacher.last_name,
        }));

      const { class_subjects, department_id, ...subjectBase } = subject;
      void class_subjects;
      void department_id;

      return {
        ...subjectBase,
        classes_assigned: classesAssigned,
        teachers_assigned: teachersAssigned,
      };
    });
  }

  // Get Subject by ID
  async getSubjectById(id: string) {
    const tenantId = this.cls.get<string>('tenantId');

    const subject = await this.prisma.subject.findUnique({
      where: { id, tenant_id: tenantId },
      include: {
        department: { select: { id: true, name: true } },
        class_subjects: {
          include: {
            class: { select: { id: true, name: true, level: true } },
            teachers: { select: { teacher_id: true } },
          },
        },
      },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    const teacherIds = [
      ...new Set(
        subject.class_subjects
          .flatMap((classSubject) =>
            classSubject.teachers.map((teacher) => teacher.teacher_id),
          )
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const teachers =
      teacherIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: teacherIds }, tenant_id: tenantId },
            select: {
              id: true,
              first_name: true,
              last_name: true,
              avatar: true,
            },
          })
        : [];

    const teacherById = new Map(
      teachers.map((teacher) => [teacher.id, teacher]),
    );

    const studentRegistrations =
      await this.prisma.studentSubjectRegistration.findMany({
        where: {
          class_subject: { subject_id: id },
          tenant_id: tenantId,
        },
        include: {
          student: {
            include: {
              user: {
                select: {
                  id: true,
                  first_name: true,
                  last_name: true,
                  avatar: true,
                  identifier: true,
                },
              },
            },
          },
        },
      });

    const uniqueStudents = [
      ...new Map(
        studentRegistrations.map((reg) => [
          reg.student.user_id,
          reg.student.user,
        ]),
      ).values(),
    ];

    const classesAssigned = subject.class_subjects.map((classSubject) => ({
      id: classSubject.id,
      class_id: classSubject.class_id,
      name: classSubject.class.name,
      level: classSubject.class.level,
    }));

    const teachersAssigned = teacherIds
      .map((teacherId) => teacherById.get(teacherId))
      .filter(
        (
          teacher,
        ): teacher is {
          id: string;
          first_name: string;
          last_name: string;
          avatar: string | null;
        } => Boolean(teacher),
      )
      .map((teacher) => ({
        user_id: teacher.id,
        first_name: teacher.first_name,
        last_name: teacher.last_name,
        avatar_url: teacher.avatar,
      }));

    const studentOffering = uniqueStudents.map((student) => ({
      user_id: student.id,
      first_name: student.first_name,
      last_name: student.last_name,
      avatar_url: student.avatar,
      matric_number: student.identifier,
    }));

    const { class_subjects, department_id, ...subjectBase } = subject;
    void class_subjects;
    void department_id;

    return {
      ...subjectBase,
      classes_assigned: classesAssigned,
      teachers_assigned: teachersAssigned,
      student_offering: studentOffering,
      classes_count: classesAssigned.length,
      teachers_count: teachersAssigned.length,
      student_count: uniqueStudents.length,
    };
  }

  // Update subject
  async updateSubject(subjectId: string, dto: UpdateSubjectDto) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.validateSubjectBelongsToTenant(subjectId, tenantId);

    return this.prisma.subject.update({
      where: { id: subjectId },
      data: {
        name: dto.name,
        title: dto.title,
        description: dto.description,
      },
      include: { department: true },
    });
  }

  // Delete subject
  async deleteSubject(subjectId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.validateSubjectBelongsToTenant(subjectId, tenantId);

    const classSubjects = (await this.prisma.classSubject.findMany({
      where: { subject_id: subjectId, tenant_id: tenantId },
      include: { teachers: { select: { teacher_id: true } } },
    })) as Array<{
      class_id: string;
      teachers: { teacher_id: string }[];
    }>;
    const classIds = [...new Set(classSubjects.map((cs) => cs.class_id))];
    const teacherIds: string[] = [];
    const seenTeachers = new Set<string>();
    for (const cs of classSubjects) {
      for (const t of cs.teachers) {
        const id = t.teacher_id;
        if (!seenTeachers.has(id)) {
          seenTeachers.add(id);
          teacherIds.push(id);
        }
      }
    }

    await this.prisma.subject.delete({
      where: { id: subjectId },
    });

    for (const cid of classIds) {
      await this.syncClassSubjectIds(cid);
    }
    for (const tid of teacherIds) {
      await this.syncTeacherAssignedSubjectIds(tid);
    }

    return { message: 'Subject deleted successfully' };
  }

  // Subject Assignments
  // Assign subject to class
  async assignSubjectToClass(dto: AssignSubjectToClassDto, classId: string) {
    const tenantId = this.cls.get<string>('tenantId');

    await this.validateClassBelongsToTenant(classId, tenantId);
    await this.validateSubjectBelongsToTenant(dto.subject_id, tenantId);

    // Check if subject not assigned
    const existingAssignment = await this.prisma.classSubject.findFirst({
      where: { class_id: classId, subject_id: dto.subject_id },
    });

    if (existingAssignment) throw new SubjectAlreadyAssignedException();

    const created = await this.prisma.classSubject.create({
      data: {
        tenant_id: tenantId,
        class_id: classId,
        subject_id: dto.subject_id,
        subject_type: dto.subject_type,
      },
      include: {
        subject: true,
        teachers: true,
      },
    });
    await this.syncClassSubjectIds(classId);
    return created;
  }

  // Bulk assign subjects to class
  async bulkAssignSubjectsToClass(dto: BulkAssignSubjectsDto, classId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.validateClassBelongsToTenant(classId, tenantId);

    const results = {
      assigned: [] as string[],
      skipped: [] as { subjectId: string; reason: string }[],
      // failed: [] as string[],
    };

    for (const item of dto.subjects) {
      try {
        await this.validateSubjectBelongsToTenant(item.subject_id, tenantId);

        const existing = await this.prisma.classSubject.findFirst({
          where: { class_id: classId, subject_id: item.subject_id },
        });

        if (existing) {
          results.skipped.push({
            subjectId: item.subject_id,
            reason: 'Subject already assigned to this class',
          });
          continue;
        }

        await this.prisma.classSubject.create({
          data: {
            tenant_id: tenantId,
            class_id: classId,
            subject_id: item.subject_id,
            subject_type: item.subject_type,
          },
        });

        results.assigned.push(item.subject_id);
      } catch (error) {
        results.skipped.push({
          subjectId: item.subject_id,
          reason: `Error assigning subject: ${error}`,
        });
        this.logger.error(error);
      }
    }
    await this.syncClassSubjectIds(classId);
    return {
      assigned: results.assigned,
      skipped: results.skipped,
      message: `${results.assigned.length} subjects assigned to class successfully, ${results.skipped.length} subjects skipped because they are already assigned to this class.`,
    };
  }

  // Unassign subject from class
  async removeSubjectFromClass(subjectId: string, classId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.validateClassBelongsToTenant(classId, tenantId);

    const classSubject = await this.prisma.classSubject.findFirst({
      where: { class_id: classId, subject_id: subjectId },
    });

    if (!classSubject) throw new SubjectNotAssignedException();

    const affectedTeachers = await this.prisma.subjectTeacher.findMany({
      where: { class_subject_id: classSubject.id },
      select: { teacher_id: true },
    });

    await this.prisma.classSubject.delete({
      where: { id: classSubject.id },
    });

    await this.syncClassSubjectIds(classId);
    for (const t of affectedTeachers) {
      await this.syncTeacherAssignedSubjectIds(
        (t as { teacher_id: string }).teacher_id,
      );
    }

    return { message: 'Subject unassigned from class successfully' };
  }

  // Assign Teacher to class subject
  async assignTeacherToClassSubject(
    teacherId: string,
    classId: string,
    subjectId: string,
  ) {
    const tenantId = this.cls.get<string>('tenantId');

    const classSubject = await this.prisma.classSubject.findFirst({
      where: { class_id: classId, subject_id: subjectId },
      include: {
        subject: true,
      },
    });

    if (!classSubject) throw new SubjectNotAssignedException();

    await this.validateTeacherBelongsToTenant(teacherId, tenantId);

    const alreadyAssigned = await this.prisma.subjectTeacher.findFirst({
      where: { class_subject_id: classSubject.id, teacher_id: teacherId },
    });

    if (alreadyAssigned) throw new TeacherAlreadyAssignedToSubjectException();

    const row = await this.prisma.subjectTeacher.create({
      data: {
        tenant_id: tenantId,
        class_subject_id: classSubject.id,
        teacher_id: teacherId,
      },
    });
    await this.syncTeacherAssignedSubjectIds(teacherId);
    return row;
  }

  async bulkAssignTeachersToClassSubjects(
    dto: BulkAssignTeachersDto,
    classId: string,
    subjectId: string,
  ) {
    const tenantId = this.cls.get<string>('tenantId');

    const classSubject = await this.prisma.classSubject.findFirst({
      where: { class_id: classId, subject_id: subjectId },
      include: {
        subject: true,
      },
    });

    if (!classSubject) throw new SubjectNotAssignedException();

    const results = {
      assigned: [] as string[],
      skipped: [] as { teacherId: string; reason: string }[],
    };

    for (const teacherId of dto.teacher_ids) {
      try {
        const alreadyAssigned = await this.prisma.subjectTeacher.findFirst({
          where: { class_subject_id: classSubject.id, teacher_id: teacherId },
        });

        if (alreadyAssigned) {
          results.skipped.push({
            teacherId,
            reason: 'Teacher already assigned to this subject in this class',
          });
          continue;
        }

        await this.prisma.subjectTeacher.create({
          data: {
            tenant_id: tenantId,
            class_subject_id: classSubject.id,
            teacher_id: teacherId,
          },
        });

        results.assigned.push(teacherId);
        await this.syncTeacherAssignedSubjectIds(teacherId);
      } catch (error) {
        results.skipped.push({
          teacherId,
          reason: `Error assigning teacher: ${error}`,
        });
        this.logger.error(error);
      }
    }

    return {
      assigned: results.assigned,
      skipped: results.skipped,
      message: `${results.assigned.length} teachers assigned to class subject successfully, ${results.skipped.length} teachers skipped because they are already assigned to this subject in this class.`,
    };
  }

  // Remove Teacher from class subject
  async removeTeacherFromClassSubject(
    teacherId: string,
    classId: string,
    subjectId: string,
  ) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.validateClassBelongsToTenant(classId, tenantId);
    await this.validateSubjectBelongsToTenant(subjectId, tenantId);
    await this.validateTeacherBelongsToTenant(teacherId, tenantId);

    const classSubject = await this.prisma.classSubject.findFirst({
      where: { class_id: classId, subject_id: subjectId },
    });

    if (!classSubject) throw new SubjectNotAssignedException();

    const assignment = await this.prisma.subjectTeacher.findFirst({
      where: { class_subject_id: classSubject.id, teacher_id: teacherId },
    });

    if (!assignment) throw new SubjectNotAssignedException();

    await this.prisma.subjectTeacher.delete({
      where: { id: assignment.id },
    });

    await this.syncTeacherAssignedSubjectIds(teacherId);

    return { message: 'Teacher removed from subject successfully' };
  }

  // Student Register Subjects
  async registerSubjectsForStudent(
    dto: RegisterSubjectsDto,
    studentId: string,
  ) {
    const tenantId = this.cls.get<string>('tenantId');

    const studentProfile = await this.prisma.studentProfile.findFirst({
      where: { user_id: studentId, tenant_id: tenantId },
    });
    if (!studentProfile?.class_id) throw new StudentNotInClassException();
    const studentClassId = studentProfile.class_id;

    // Get current active term
    const currentTerm = await this.prisma.academicTerm.findFirst({
      where: { tenant_id: tenantId, is_current: true },
    });
    if (!currentTerm) throw new ActiveTermRequiredException();

    // Get all subjects in the class
    const allClassSubjects = await this.prisma.classSubject.findMany({
      where: { class_id: studentClassId },
    });

    // console.log('allClassSubjects', allClassSubjects);

    const compulsoryIds = allClassSubjects
      .filter((item) => item.subject_type === SubjectType.COMPULSORY)
      .map((item) => item.id);

    const electiveIds = allClassSubjects
      .filter((item) => item.subject_type === SubjectType.ELECTIVE)
      .map((item) => item.id);

    const optionalIds = allClassSubjects
      .filter((item) => item.subject_type === SubjectType.OPTIONAL)
      .map((item) => item.id);

    // Validate every class subject id is in the class
    for (const classSubjectId of dto.class_subject_ids) {
      const classSubject = allClassSubjects.find(
        (item) => item.subject_id === classSubjectId,
      );
      // console.log('classSubject', classSubject);
      if (!classSubject) throw new SubjectNotAssignedException();
    }

    const requestedElectives = dto.class_subject_ids.filter((item) =>
      electiveIds.includes(item),
    );

    const subjectsToRegister = [
      ...new Set([...compulsoryIds, ...requestedElectives, ...optionalIds]),
    ];

    // Register everything in a transaction
    await this.prisma.$transaction(async (tx) => {
      for (const classSubjectId of subjectsToRegister) {
        await tx.studentSubjectRegistration.upsert({
          where: {
            tenant_id_student_id_class_subject_id_term_id: {
              tenant_id: tenantId,
              student_id: studentProfile.id,
              class_subject_id: classSubjectId,
              term_id: currentTerm.id,
            },
          },
          create: {
            tenant_id: tenantId,
            student_id: studentProfile.id,
            class_subject_id: classSubjectId,
            term_id: currentTerm.id,
          },
          update: {},
        });
      }
    });

    await this.syncStudentRegisteredSubjectIdsForTerm(
      studentProfile.id,
      currentTerm.id,
    );

    return this.getStudentRegistration(studentId);
  }

  async updateSubjectRegistration(
    dto: UpdateSubjectRegistrationDto,
    studentId: string,
  ) {
    const tenantId = this.cls.get<string>('tenantId');

    const studentProfile = await this.prisma.studentProfile.findFirst({
      where: { user_id: studentId, tenant_id: tenantId },
    });
    if (!studentProfile?.class_id) throw new StudentNotInClassException();
    const studentClassId = studentProfile.class_id;

    const currentTerm = await this.prisma.academicTerm.findFirst({
      where: { tenant_id: tenantId, is_current: true },
    });

    if (!currentTerm) throw new ActiveTermRequiredException();

    const allClassSubjects = await this.prisma.classSubject.findMany({
      where: { class_id: studentClassId },
    });

    const compulsoryIds = allClassSubjects
      .filter((item) => item.subject_type === SubjectType.COMPULSORY)
      .map((item) => item.id);

    for (const compulsoryId of compulsoryIds) {
      if (!dto.class_subject_ids.includes(compulsoryId)) {
        throw new CompulsorySubjectCannotDeregisterException();
      }
    }

    for (const classSubjectId of dto.class_subject_ids) {
      const validForClass = allClassSubjects.find(
        (item) => item.id === classSubjectId,
      );
      if (!validForClass) throw new SubjectNotAssignedException();
    }

    await this.prisma.$transaction(async (tx) => {
      // Remove all current elective registrations for this term
      await tx.studentSubjectRegistration.deleteMany({
        where: {
          student_id: studentProfile.id,
          class_subject: { subject_type: SubjectType.ELECTIVE },
          term_id: currentTerm.id,
        },
      });

      // Re-register with the new selection
      for (const classSubjectId of dto.class_subject_ids) {
        await tx.studentSubjectRegistration.upsert({
          where: {
            tenant_id_student_id_class_subject_id_term_id: {
              tenant_id: tenantId,
              student_id: studentProfile.id,
              class_subject_id: classSubjectId,
              term_id: currentTerm.id,
            },
          },
          create: {
            tenant_id: tenantId,
            student_id: studentProfile.id,
            class_subject_id: classSubjectId,
            term_id: currentTerm.id,
          },
          update: {},
        });
      }
    });

    await this.syncStudentRegisteredSubjectIdsForTerm(
      studentProfile.id,
      currentTerm.id,
    );

    return this.getStudentRegistration(studentId);
  }

  async getStudentRegistration(studentId: string) {
    const tenantId = this.cls.get<string>('tenantId');

    const studentProfile = await this.prisma.studentProfile.findFirst({
      where: { user_id: studentId, tenant_id: tenantId },
    });
    if (!studentProfile) throw new UserNotFoundException();

    const currentTerm = await this.prisma.academicTerm.findFirst({
      where: { tenant_id: tenantId, is_current: true },
    });

    if (!currentTerm) throw new ActiveTermRequiredException();

    return this.prisma.studentSubjectRegistration.findMany({
      where: { student_id: studentProfile.id, term_id: currentTerm.id },
      include: {
        class_subject: {
          include: {
            subject: true,
            teachers: true,
          },
        },
      },
    });
  }

  // SCHOOL OVERVIEW
  async getSchoolOverview() {
    const tenantId = this.cls.get<string>('tenantId');

    const [
      currentSession,
      currentTerm,
      classCount,
      subjectCount,
      departmentCount,
      classByLevel,
    ] = await Promise.all([
      this.prisma.academicSession.findFirst({
        where: { tenant_id: tenantId, is_current: true },
      }),
      this.prisma.academicTerm.findFirst({
        where: { tenant_id: tenantId, is_current: true },
        include: { academicSession: true },
      }),
      this.prisma.class.count({ where: { tenant_id: tenantId } }),
      this.prisma.subject.count({ where: { tenant_id: tenantId } }),
      this.prisma.department.count({ where: { tenant_id: tenantId } }),
      // Group class by level
      this.prisma.class.groupBy({
        where: { tenant_id: tenantId },
        by: ['level'],
        _count: { id: true },
      }),
    ]);

    return {
      current_session: currentSession,
      current_term: currentTerm,
      stats: {
        classes: classCount,
        subjects: subjectCount,
        departments: departmentCount,
      },
      classByLevel: classByLevel.map(
        (item: { level: string; _count: { id: number } }) => ({
          level: item.level,
          count: item._count.id,
        }),
      ),
    };
  }

  /** Denormalized `classes.subject_ids` from ClassSubject rows. */
  private async syncClassSubjectIds(classId: string): Promise<void> {
    const rows = await this.prisma.classSubject.findMany({
      where: { class_id: classId },
      select: { subject_id: true },
    });
    const ids = [
      ...new Set(rows.map((r: { subject_id: string }) => r.subject_id)),
    ];
    await this.prisma.class.update({
      where: { id: classId },
      data: { subject_ids: ids },
    });
  }

  /** Denormalized `teacher_profiles.assigned_subject_ids` (teacher_id = User.id). */
  private async syncTeacherAssignedSubjectIds(
    teacherUserId: string,
  ): Promise<void> {
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { user_id: teacherUserId },
      select: { id: true },
    });
    if (!profile) return;

    const assignments = await this.prisma.subjectTeacher.findMany({
      where: { teacher_id: teacherUserId },
      include: { class_subject: { select: { subject_id: true } } },
    });
    const ids = [
      ...new Set(
        assignments.map(
          (a: { class_subject: { subject_id: string } }) =>
            a.class_subject.subject_id,
        ),
      ),
    ];
    await this.prisma.teacherProfile.update({
      where: { id: profile.id },
      data: { assigned_subject_ids: ids },
    });
  }

  /**
   * Denormalized `student_profiles.registered_subject_ids` for the given term
   * (distinct Subject.id from registrations in that term).
   */
  private async syncStudentRegisteredSubjectIdsForTerm(
    studentProfileId: string,
    termId: string,
  ): Promise<void> {
    const regs = await this.prisma.studentSubjectRegistration.findMany({
      where: { student_id: studentProfileId, term_id: termId },
      include: { class_subject: { select: { subject_id: true } } },
    });
    const ids = [
      ...new Set(
        regs.map(
          (r: { class_subject: { subject_id: string } }) =>
            r.class_subject.subject_id,
        ),
      ),
    ];
    await this.prisma.studentProfile.update({
      where: { id: studentProfileId },
      data: { registered_subject_ids: ids },
    });
  }

  // Private validation helpers
  private async validateAcademicSessionBelongsToTenant(
    sessionId: string,
    tenantId: string,
  ) {
    const academicSession = await this.prisma.academicSession.findUnique({
      where: { id: sessionId, tenant_id: tenantId },
      include: { terms: true },
    });

    if (!academicSession) {
      throw new NotFoundException('Academic session not found');
    }
    return academicSession;
  }

  private async validateAcademicTermBelongsToTenant(
    termId: string,
    tenantId: string,
  ) {
    const term = await this.prisma.academicTerm.findUnique({
      where: { id: termId, tenant_id: tenantId },
    });
    if (!term) {
      throw new NotFoundException('Academic term not found');
    }
    return term;
  }

  private async validateDepartmentBelongsToTenant(
    departmentId: string,
    tenantId: string,
  ) {
    const dept = await this.prisma.department.findUnique({
      where: { id: departmentId, tenant_id: tenantId },
    });
    if (!dept) {
      throw new NotFoundException('Department not found');
    }
    return dept;
  }

  /** A user may be HOD of at most one department per tenant. */
  private async assertHodNotDuplicatedAcrossDepartments(
    tenantId: string,
    hodUserId: string,
    excludeDepartmentId?: string,
  ): Promise<void> {
    const existing = await this.prisma.department.findFirst({
      where: {
        tenant_id: tenantId,
        hod_id: hodUserId,
        ...(excludeDepartmentId ? { NOT: { id: excludeDepartmentId } } : {}),
      },
      select: { id: true, name: true },
    });
    if (existing) {
      throw new ConflictException(
        `This teacher is already head of department "${existing.name}". A teacher can only head one department.`,
      );
    }
  }

  /** New department + HOD: teacher must not already be tied to another department on their profile. */
  private async assertTeacherProfileClearForNewHodAppointment(
    tenantId: string,
    teacherUserId: string,
  ): Promise<void> {
    const profile = await this.prisma.teacherProfile.findFirst({
      where: { user_id: teacherUserId, tenant_id: tenantId },
      select: { department_id: true },
    });
    if (profile?.department_id) {
      throw new ConflictException(
        'This teacher is already assigned to a department on their profile. Clear that assignment before appointing them as head of a new department.',
      );
    }
  }

  /** Appointing / keeping HOD: profile department must match this department (or be unset). */
  private async assertTeacherProfileDepartmentMatchesHodDepartment(
    tenantId: string,
    teacherUserId: string,
    departmentId: string,
  ): Promise<void> {
    const profile = await this.prisma.teacherProfile.findFirst({
      where: { user_id: teacherUserId, tenant_id: tenantId },
      select: { department_id: true },
    });
    if (
      profile?.department_id != null &&
      profile.department_id !== departmentId
    ) {
      throw new ConflictException(
        'This teacher is assigned to a different department on their profile. Align their profile department with this department before appointing them as HOD.',
      );
    }
  }

  private async validateTeacherBelongsToTenant(
    teacherId: string,
    tenantId: string,
  ) {
    const teacher = await this.prisma.user.findFirst({
      where: { id: teacherId, tenant_id: tenantId, role: 'TEACHER' },
    });
    // console.log(teacher);
    if (!teacher) {
      throw new NotFoundException('Teacher not found in this school');
    }
    return teacher;
  }

  private async validateClassBelongsToTenant(
    classId: string,
    tenantId: string,
  ) {
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, tenant_id: tenantId },
    });
    if (!cls) {
      throw new NotFoundException('Class not found');
    }
    return cls;
  }

  private async validateSubjectBelongsToTenant(
    subjectId: string,
    tenantId: string,
  ) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, tenant_id: tenantId },
    });
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }
    return subject;
  }

  private async validateStudentBelongsToTenant(
    studentId: string,
    tenantId: string,
  ) {
    const student = await this.prisma.studentProfile.findFirst({
      where: { user_id: studentId, tenant_id: tenantId },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    return student;
  }
}
