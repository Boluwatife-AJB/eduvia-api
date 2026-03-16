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
  CreateAcademicSessionDto,
  UpdateAcademicSessionDto,
} from './dto/academic-session.dto';
import {
  AssignSubjectToClassDto,
  AssignTeacherToClassSubjectDto,
  BulkAssignSubjectsDto,
} from './dto/class-subject.dto';
import { CreateClassDto, UpdateClassDto } from './dto/class.dto';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/subject.dto';
import { CreateTermDto, UpdateTermDto } from './dto/term.dto';

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
        tenantId,
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
          tenantId,
          isCurrent: true,
        },
        data: {
          isCurrent: false,
        },
      });
    }

    const academicSession = await this.prisma.academicSession.create({
      data: {
        tenantId,
        name: dto.name,
        startDate: new Date(dto.start_date),
        endDate: new Date(dto.end_date),
        isCurrent: dto.is_current ?? false,
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
      where: { tenantId },
      include: {
        terms: {
          orderBy: { startDate: 'asc' },
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  // Get current academic session
  async getCurrentAcademicSession() {
    const tenantId = this.cls.get<string>('tenantId');

    const currentSession = await this.prisma.academicSession.findFirst({
      where: { tenantId, isCurrent: true },
      include: {
        terms: {
          orderBy: { startDate: 'asc' },
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
        where: { tenantId, isCurrent: true },
        data: { isCurrent: false },
      }),
      this.prisma.academicSession.update({
        where: { id: sessionId },
        data: { isCurrent: true },
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

    if (academicSession.isCurrent) {
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
      where: { academicSessionId: dto.academic_session_id, name: dto.name },
    });

    if (existingTerm) {
      throw new ConflictException(
        `Term '${dto.name}' already exists in this session`,
      );
    }

    // Enforce max 3 terms per session
    const termsCount = await this.prisma.academicTerm.count({
      where: { academicSessionId: dto.academic_session_id },
    });
    if (termsCount >= 3) {
      throw new BadRequestException(
        'Cannot create more than 3 terms per session',
      );
    }

    // Only one term can be current at a time
    if (dto.is_current) {
      await this.prisma.academicTerm.updateMany({
        where: { tenantId, isCurrent: true },
        data: { isCurrent: false },
      });
    }

    return this.prisma.academicTerm.create({
      data: {
        tenantId,
        academicSessionId: dto.academic_session_id,
        name: dto.name,
        startDate: new Date(dto.start_date),
        endDate: new Date(dto.end_date),
        isCurrent: dto.is_current ?? false,
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
      where: { academicSessionId, tenantId },
      orderBy: { startDate: 'asc' },
    });
  }

  // Get current term
  async getCurrentTerm() {
    const tenantId = this.cls.get<string>('tenantId');

    const term = await this.prisma.academicTerm.findFirst({
      where: { tenantId, isCurrent: true },
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
        where: { tenantId, isCurrent: true },
        data: { isCurrent: false },
      }),
      this.prisma.academicTerm.update({
        where: { id: termId },
        data: { isCurrent: true },
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
        ...(dto.start_date && { startDate: new Date(dto.start_date) }),
        ...(dto.end_date && { endDate: new Date(dto.end_date) }),
      },
      include: { academicSession: true },
    });
  }

  // Departments
  // Create department
  async createDepartment(dto: CreateDepartmentDto) {
    const tenantId = this.cls.get<string>('tenantId');

    const existingDepartment = await this.prisma.department.findFirst({
      where: { tenantId, name: dto.name },
    });

    if (existingDepartment) {
      throw new ConflictException(
        `Department '${dto.name}' already exists in this school`,
      );
    }

    if (dto.hod_id) {
      await this.validateTeacherBelongsToTenant(dto.hod_id, tenantId);
    }

    return this.prisma.department.create({
      data: {
        tenantId,
        ...dto,
      },
    });
  }

  // Get all departments
  async getDepartments() {
    const tenantId = this.cls.get<string>('tenantId');

    const departments = await this.prisma.department.findMany({
      where: { tenantId },
      include: {
        subjects: { select: { id: true, name: true, code: true } },
        classes: { select: { id: true, name: true, level: true } },
        // TODO: Uncomment this when we have staff profiles
        // hod: { select: { id: true, name: true, email: true } },
      },
      orderBy: { name: 'asc' },
    });

    return departments;
  }

  // Update department
  async updateDepartment(departmentId: string, dto: UpdateDepartmentDto) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.validateDepartmentBelongsToTenant(departmentId, tenantId);

    if (dto.hod_id) {
      await this.validateTeacherBelongsToTenant(dto.hod_id, tenantId);
    }

    return this.prisma.department.update({
      where: { id: departmentId },
      data: {
        name: dto.name,
        description: dto.description,
        hodId: dto.hod_id,
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
        where: { departmentId },
        data: { departmentId: null },
      }),
      this.prisma.class.updateMany({
        where: { departmentId },
        data: { departmentId: null },
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
      where: { tenantId, name: dto.name },
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
        tenantId,
        name: dto.name,
        level: dto.level,
        capacity: dto.capacity ?? 0,
        departmentId: dto.department_id ?? null,
        classTeacherId: dto.class_teacher_id ?? null,
      },
      include: {
        department: true,
        classSubjects: { include: { subject: true } },
      },
    });
  }

  // get all classes
  async getClasses(level?: string) {
    const tenantId = this.cls.get<string>('tenantId');

    return this.prisma.class.findMany({
      where: { tenantId, ...(level && { level }) },
      include: {
        department: { select: { id: true, name: true } },
        classSubjects: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
          },
        },
        _count: { select: { students: true } },
      },

      orderBy: [{ name: 'asc' }, { level: 'asc' }],
    });
  }

  // Get class by id
  async getClassById(classId: string) {
    const tenantId = this.cls.get<string>('tenantId');

    const cls = await this.prisma.class.findUnique({
      where: { id: classId, tenantId },
      include: {
        department: true,
        classSubjects: { include: { subject: true } },
        students: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
                identifier: true,
              },
            },
          },
        },
        _count: { select: { students: true, classSubjects: true } },
      },
    });
    if (!cls) {
      throw new NotFoundException('Class not found');
    }
    return cls;
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
        where: { tenantId, name: dto.name, NOT: { id: classId } },
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
        departmentId: dto.department_id ?? null,
        classTeacherId: dto.class_teacher_id ?? null,
      },
      include: {
        department: true,
        classSubjects: { include: { subject: true } },
      },
    });
  }

  // Delete class
  async deleteClass(classId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.validateClassBelongsToTenant(classId, tenantId);

    // Prevent deletion if class has students
    const studentsCount = await this.prisma.studentProfile.count({
      where: { classId },
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

  // Subjects
  // Create subject
  // BUG: SUbject with the same name can be created in the same department and the same school but different code because SS1-SS3 offers the same subject with different codes.
  async createSubject(dto: CreateSubjectDto) {
    const tenantId = this.cls.get<string>('tenantId');

    const exisiting = await this.prisma.subject.findFirst({
      where: { tenantId, code: dto.code },
    });

    if (exisiting) {
      throw new ConflictException(
        `Subject with code '${dto.code}' already exists in this school`,
      );
    }

    if (dto.department_id) {
      await this.validateDepartmentBelongsToTenant(dto.department_id, tenantId);
    }

    return this.prisma.subject.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code,
        description: dto.description,
        departmentId: dto.department_id ?? null,
      },
      include: { department: true },
    });
  }

  // Get subjects by department
  async getSubjects(departmentId?: string) {
    const tenantId = this.cls.get<string>('tenantId');

    return this.prisma.subject.findMany({
      where: { tenantId, ...(departmentId && { departmentId }) },
      include: {
        department: { select: { id: true, name: true } },
        classSubjects: {
          include: { class: { select: { id: true, name: true, level: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  // Get Subject by ID
  async getSubjectsById(id: string) {
    const tenantId = this.cls.get<string>('tenantId');

    const subject = await this.prisma.subject.findUnique({
      where: { id, tenantId },
      include: {
        department: { select: { id: true, name: true } },
        // TODO: Add classes offering this subject
        // classSubjects: {
        //   include: { class: { select: { id: true, name: true, level: true } } },
        // },
      },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    return subject;
  }

  // Update subject
  async updateSubject(subjectId: string, dto: UpdateSubjectDto) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.validateSubjectBelongsToTenant(subjectId, tenantId);

    if (dto.name) {
      const existingSubject = await this.prisma.subject.findFirst({
        where: { tenantId, code: dto.code, NOT: { id: subjectId } },
      });
      if (existingSubject) {
        throw new ConflictException(
          `Subject with code '${dto.code}' already exists in this school`,
        );
      }
    }
    return this.prisma.subject.update({
      where: { id: subjectId },
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        departmentId: dto.department_id ?? null,
      },
      // include: { department: true },
    });
  }

  // Delete subject
  async deleteSubject(subjectId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.validateSubjectBelongsToTenant(subjectId, tenantId);

    // Remove all classes first
    await this.prisma.classSubject.deleteMany({
      where: { subjectId },
    });
    await this.prisma.subject.delete({
      where: { id: subjectId },
    });
    return { message: 'Subject deleted successfully' };
  }

  // Subject Assignments
  // Assign subject to class
  async assignSubjectToClass(dto: AssignSubjectToClassDto, classId: string) {
    const tenantId = this.cls.get<string>('tenantId');

    await this.validateClassBelongsToTenant(classId, tenantId);
    await this.validateSubjectBelongsToTenant(dto.subject_id, tenantId);

    if (dto.teacher_id) {
      await this.validateTeacherBelongsToTenant(dto.teacher_id, tenantId);
    }

    // Check if subject not assigned
    const existingAssignment = await this.prisma.classSubject.findFirst({
      where: { classId, subjectId: dto.subject_id },
    });
    if (existingAssignment) {
      throw new ConflictException(`Subject is already assigned to this class`);
    }

    return this.prisma.classSubject.create({
      data: {
        tenantId,
        classId,
        subjectId: dto.subject_id,
        teacherId: dto.teacher_id ?? null,
      },
      include: {
        subject: true,
      },
    });
  }

  // Bulk assign subjects to class
  async bulkAssignSubjectsToClass(dto: BulkAssignSubjectsDto, classId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.validateClassBelongsToTenant(classId, tenantId);

    const results = {
      assigned: [] as string[],
      skipped: [] as string[],
      // failed: [] as string[],
    };

    for (const subjectId of dto.subject_ids) {
      try {
        await this.validateSubjectBelongsToTenant(subjectId, tenantId);

        const existing = await this.prisma.classSubject.findFirst({
          where: { classId, subjectId },
        });
        if (existing) {
          results.skipped.push(subjectId);
          continue;
        }

        await this.prisma.classSubject.create({
          data: { tenantId, classId, subjectId },
        });

        results.assigned.push(subjectId);
      } catch (error) {
        results.skipped.push(subjectId);
        this.logger.error(error);
      }
    }
    return {
      ...results,
      message: `${results.assigned.length} subjects assigned to class successfully, ${results.skipped.length} subjects skipped because they are already assigned to this class.`,
    };
  }

  // Unassign subject from class
  async removeSubjectFromClass(subjectId: string, classId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.validateClassBelongsToTenant(classId, tenantId);

    const classSubject = await this.prisma.classSubject.findFirst({
      where: { classId, subjectId },
    });

    if (!classSubject) {
      throw new NotFoundException('Subject not assigned to this class');
    }

    await this.prisma.classSubject.delete({
      where: { id: classSubject.id },
    });

    return { message: 'Subject unassigned from class successfully' };
  }

  // Assign Teacher to class subject
  async assignTeacherToClassSubject(
    dto: AssignTeacherToClassSubjectDto,
    classId: string,
    subjectId: string,
  ) {
    const tenantId = this.cls.get<string>('tenantId');

    await this.validateTeacherBelongsToTenant(dto.teacher_id, tenantId);

    const classSubject = await this.prisma.classSubject.findFirst({
      where: { classId, subjectId },
    });

    if (!classSubject) {
      throw new NotFoundException('Subject not assigned to this class');
    }

    return this.prisma.classSubject.update({
      where: { id: classSubject.id },
      data: { teacherId: dto.teacher_id },
      include: {
        subject: true,
      },
    });

    // return { message: 'Teacher assigned to class subject successfully' };
  }

  // TODO: Bulk assign teachers to subjects

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
        where: { tenantId, isCurrent: true },
      }),
      this.prisma.academicTerm.findFirst({
        where: { tenantId, isCurrent: true },
        include: { academicSession: true },
      }),
      this.prisma.class.count({ where: { tenantId } }),
      this.prisma.subject.count({ where: { tenantId } }),
      this.prisma.department.count({ where: { tenantId } }),
      // Group class by level
      this.prisma.class.groupBy({
        where: { tenantId },
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
      classByLevel: classByLevel.map((item) => ({
        level: item.level,
        count: item._count.id,
      })),
    };
  }

  // Private validation helpers
  private async validateAcademicSessionBelongsToTenant(
    sessionId: string,
    tenantId: string,
  ) {
    const academicSession = await this.prisma.academicSession.findUnique({
      where: { id: sessionId, tenantId },
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
      where: { id: termId, tenantId },
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
      where: { id: departmentId, tenantId },
    });
    if (!dept) {
      throw new NotFoundException('Department not found');
    }
    return dept;
  }

  private async validateTeacherBelongsToTenant(
    teacherId: string,
    tenantId: string,
  ) {
    const teacher = await this.prisma.user.findFirst({
      where: { id: teacherId, tenantId, role: 'TEACHER' },
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
      where: { id: classId, tenantId },
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
      where: { id: subjectId, tenantId },
    });
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }
    return subject;
  }
}
