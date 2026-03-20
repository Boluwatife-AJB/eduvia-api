import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { ClsService } from 'nestjs-cls';
import {
  CreateTimetableSlotDto,
  QueryTimetableDto,
  UpdateTimetableSlotDto,
} from './dto/timetable-slot.dto';
import {
  ActiveTermRequiredException,
  ClassNotFoundException,
  ClassScheduleConflictException,
  InvalidTimeRangeException,
  SlotNotInSchoolHoursException,
  SubjectNotAssignedException,
  SubjectNotFoundException,
  TeacherScheduleConflictException,
  TimetableSlotNotFoundException,
  TutorialClassNotFoundException,
  TutorialTimeConflictException,
  UserNotFoundException,
} from 'src/errors/exceptions/business.exception';
import { DayOfWeek } from 'src/generated/prisma/enums';
import {
  CreateTutorialClassDto,
  UpdateTutorialClassDto,
} from './dto/tutorial-class.dto';

// Operating Hours: 08:00 - 16:00 !This will be later stored in the tenant(school) configuration
const SCHOOL_OPEN = '08:00';
const SCHOOL_CLOSE = '16:00';

@Injectable()
export class TimetableService {
  private readonly logger = new Logger(TimetableService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  // TIMETABLE SLOTS
  // Create a new timetable slot
  async createTimetableSlot(dto: CreateTimetableSlotDto) {
    const tenantId = this.cls.get<string>('tenantId');

    const currentTerm = await this.prisma.academicTerm.findFirst({
      where: { tenant_id: tenantId, is_current: true },
    });
    if (!currentTerm) throw new ActiveTermRequiredException();

    // Validate all referenced records exist in this school
    await this.validateClassExists(dto.class_id, tenantId);
    await this.validateTeacherExists(dto.teacher_id, tenantId);
    await this.validateSubjectAssignedToClass(dto.subject_id, dto.class_id);

    // Validate time logic
    this.validateTimeRange(dto.start_time, dto.end_time);
    this.validateSchoolHours(dto.start_time, dto.end_time);

    // Check for time conflicts with existing slots
    await this.checkTeacherConflict(
      dto.teacher_id,
      dto.day_of_week,
      dto.start_time,
      dto.end_time,
      currentTerm.id,
      null,
    );
    await this.checkClassConflict(
      dto.class_id,
      dto.day_of_week,
      dto.start_time,
      dto.end_time,
      currentTerm.id,
      null,
    );

    const slot = await this.prisma.timeTableSlot.create({
      data: {
        tenant_id: tenantId,
        class_id: dto.class_id,
        subject_id: dto.subject_id,
        teacher_id: dto.teacher_id,
        academic_term_id: currentTerm.id,
        day_of_week: dto.day_of_week,
        start_time: dto.start_time,
        end_time: dto.end_time,
        venue: dto.venue ?? null,
      },
      include: this.slotIncludes(),
    });

    this.logger.log(
      `Timetable slot created: ${dto.day_of_week} ${dto.start_time} - ${dto.end_time} for teacher ${dto.teacher_id} in class ${dto.class_id} and subject ${dto.subject_id} in tenant ${tenantId}`,
    );

    return slot;
  }

  // Update a timetable slot
  async updateTimetableSlot(slotId: string, dto: UpdateTimetableSlotDto) {
    const tenantId = this.cls.get<string>('tenantId');
    const existing = await this.validateSlotExists(slotId, tenantId);

    const dayOfWeek = dto.day_of_week ?? existing.day_of_week;
    const startTime = dto.start_time ?? existing.start_time;
    const endTime = dto.end_time ?? existing.end_time;
    const teacherId = dto.teacher_id ?? existing.teacher_id;

    if (dto.start_time || dto.end_time) {
      this.validateTimeRange(startTime, endTime);
      this.validateSchoolHours(startTime, endTime);
    }

    // Recheck for conflicts, excluding the existing slot so that it doesn't conflict with itself
    if (dto.day_of_week || dto.start_time || dto.end_time || dto.teacher_id) {
      await this.checkTeacherConflict(
        teacherId,
        dayOfWeek,
        startTime,
        endTime,
        existing.academic_term_id,
        slotId,
      );
      await this.checkClassConflict(
        existing.class_id,
        dayOfWeek,
        startTime,
        endTime,
        existing.academic_term_id,
        slotId,
      );
    }

    return this.prisma.timeTableSlot.update({
      where: { id: slotId },
      data: {
        ...(dto.day_of_week && { day_of_week: dto.day_of_week }),
        ...(dto.start_time && { start_time: dto.start_time }),
        ...(dto.end_time && { end_time: dto.end_time }),
        ...(dto.teacher_id && { teacher_id: dto.teacher_id }),
        ...(dto.venue !== undefined && { venue: dto.venue }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
      },
      include: this.slotIncludes(),
    });
  }

  // Delete a timetable slot
  async deleteSlot(slotId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.validateSlotExists(slotId, tenantId);

    await this.prisma.timeTableSlot.delete({
      where: { id: slotId },
    });

    this.logger.log(`Timetable slot deleted: ${slotId} in tenant ${tenantId}`);

    return { message: 'Timetable slot deleted successfully' };
  }

  // VIEWS
  // Get full timetable for a class
  async getClassTimetable(classId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.validateClassExists(classId, tenantId);

    const currentTerm = await this.prisma.academicTerm.findFirst({
      where: { tenant_id: tenantId, is_current: true },
    });
    if (!currentTerm) throw new ActiveTermRequiredException();

    const slots = await this.prisma.timeTableSlot.findMany({
      where: {
        tenant_id: tenantId,
        class_id: classId,
        academic_term_id: currentTerm.id,
        is_active: true,
      },
      include: this.slotIncludes(),
      orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
    });

    return this.groupByDay(slots);
  }

  // Get full timetable for a teacher
  async getTeacherTimetable(teacherId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.validateTeacherExists(teacherId, tenantId);

    const currentTerm = await this.prisma.academicTerm.findFirst({
      where: { tenant_id: tenantId, is_current: true },
    });
    if (!currentTerm) throw new ActiveTermRequiredException();

    const slots = await this.prisma.timeTableSlot.findMany({
      where: {
        tenant_id: tenantId,
        teacher_id: teacherId,
        academic_term_id: currentTerm.id,
        is_active: true,
      },
      include: this.slotIncludes(),
      orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
    });

    return this.groupByDay(slots);
  }

  // Get Student's timetable showing only registered subjects
  async getStudentTimetable(studentUserId: string) {
    const tenantId = this.cls.get<string>('tenantId');

    const studentProfile = await this.prisma.studentProfile.findFirst({
      where: { user_id: studentUserId, tenant_id: tenantId },
    });
    if (!studentProfile)
      throw new BadRequestException('Student is not assigned to any class.');

    const currentTerm = await this.prisma.academicTerm.findFirst({
      where: { tenant_id: tenantId, is_current: true },
    });
    if (!currentTerm) throw new ActiveTermRequiredException();

    const registeredSubjects =
      await this.prisma.studentSubjectRegistration.findMany({
        where: { student_id: studentProfile.id, term_id: currentTerm.id },
        include: { classSubject: { select: { subject_id: true } } },
      });

    const registeredSubjectIds = registeredSubjects.map(
      (item) => item.classSubject.subject_id,
    );

    // Return timetable slots for registered subjects only
    const slots = await this.prisma.timeTableSlot.findMany({
      where: {
        tenant_id: tenantId,
        class_id: studentProfile.class_id ?? '',
        academic_term_id: currentTerm.id,
        is_active: true,
        subject_id: { in: registeredSubjectIds },
      },
      include: this.slotIncludes(),
      orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
    });

    return this.groupByDay(slots);
  }

  // Get Entire timetable for a school
  async getSchoolTimetable(query: QueryTimetableDto) {
    const tenantId = this.cls.get<string>('tenantId');

    const currentTerm = await this.prisma.academicTerm.findFirst({
      where: { tenant_id: tenantId, is_current: true },
    });
    if (!currentTerm) throw new ActiveTermRequiredException();

    const slots = await this.prisma.timeTableSlot.findMany({
      where: {
        tenant_id: tenantId,
        academic_term_id: currentTerm.id,
        is_active: true,
        ...(query.class_id && { class_id: query.class_id }),
        ...(query.teacher_id && { teacher_id: query.teacher_id }),
        ...(query.day_of_week && { day_of_week: query.day_of_week }),
      },
      include: this.slotIncludes(),
      orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
    });

    return slots;
  }

  // TUTORIAL CLASSES

  // Create a new tutorial class
  async createTutorialClass(
    teacherUserId: string,
    dto: CreateTutorialClassDto,
  ) {
    const tenantId = this.cls.get<string>('tenantId');

    const currentTerm = await this.prisma.academicTerm.findFirst({
      where: { tenant_id: tenantId, is_current: true },
    });
    if (!currentTerm) throw new ActiveTermRequiredException();

    const start = new Date(dto.start_time);
    const end = new Date(dto.end_time);

    if (start >= end) throw new InvalidTimeRangeException();

    // Validate if subject exists in this school
    const subject = await this.prisma.subject.findFirst({
      where: { id: dto.subject_id, tenant_id: tenantId },
    });
    if (!subject) throw new SubjectNotFoundException();

    if (dto.class_id) {
      await this.validateClassExists(dto.class_id, tenantId);
    }

    // Check for time conflicts with existing tutorial classes
    await this.checkTeacherTutorialConflict(teacherUserId, start, end, null);

    const tutorial = await this.prisma.tutorialClass.create({
      data: {
        tenant_id: tenantId,
        teacher_id: teacherUserId,
        subject_id: dto.subject_id,
        class_id: dto.class_id ?? null,
        academic_term_id: currentTerm.id,
        title: dto.title,
        description: dto.description ?? null,
        venue: dto.venue ?? null,
        start_time: start,
        end_time: end,
        is_recurring: dto.is_recurring ?? false,
        recurring_day: dto.is_recurring ? dto.recurring_day : null,
        max_students: dto.max_students ?? null,
      },
      include: {
        subject: { select: { id: true, name: true, code: true, title: true } },
        // class: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } },
      },
    });

    this.logger.log(
      `Tutorial class created: ${dto.title} for teacher ${teacherUserId} in subject ${dto.subject_id} in tenant ${tenantId}`,
    );

    return tutorial;
  }

  // Update a tutorial class
  async updateTutorialClass(
    tutorialId: string,
    teacherUserId: string,
    dto: UpdateTutorialClassDto,
  ) {
    const tenantId = this.cls.get<string>('tenantId');
    const existing = await this.validateTutorialExists(
      tutorialId,
      tenantId,
      teacherUserId,
    );

    if (dto.start_time || dto.end_time) {
      const start = new Date(dto.start_time ?? existing.start_time);
      const end = new Date(dto.end_time ?? existing.end_time);

      if (start >= end) throw new InvalidTimeRangeException();
      await this.checkTeacherTutorialConflict(
        teacherUserId,
        start,
        end,
        tutorialId,
      );
    }

    return this.prisma.tutorialClass.update({
      where: { id: tutorialId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description && { description: dto.description }),
        ...(dto.venue && { venue: dto.venue }),
        ...(dto.start_time && { start_time: dto.start_time }),
        ...(dto.end_time && { end_time: dto.end_time }),
        ...(dto.max_students && { max_students: dto.max_students }),
      },
      include: {
        subject: { select: { id: true, name: true, code: true, title: true } },
        // class: { select: { id: true, name: true } },
        // term: { select: { id: true, name: true } },
      },
    });
  }

  // Delete a tutorial class
  async deleteTutorialClass(tutorialId: string, teacherUserId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.validateTutorialExists(tutorialId, tenantId, teacherUserId);

    await this.prisma.tutorialClass.delete({
      where: { id: tutorialId },
    });

    this.logger.log(
      `Tutorial class deleted: ${tutorialId} for teacher ${teacherUserId} in tenant ${tenantId}`,
    );

    return { message: 'Tutorial class deleted successfully' };
  }

  // Get a tutorial class by teacher
  async getTutorialClassByTeacher(teacherUserId: string) {
    const tenantId = this.cls.get<string>('tenantId');

    const currentTerm = await this.prisma.academicTerm.findFirst({
      where: { tenant_id: tenantId, is_current: true },
    });
    if (!currentTerm) throw new ActiveTermRequiredException();

    const tutorial = await this.prisma.tutorialClass.findMany({
      where: {
        tenant_id: tenantId,
        teacher_id: teacherUserId,
        academic_term_id: currentTerm.id,
      },
      include: {
        subject: { select: { id: true, name: true, code: true, title: true } },
      },
      orderBy: [{ start_time: 'asc' }],
    });

    return tutorial;
  }

  // Private Helpers

  // Conflict Helpers
  private async checkTeacherConflict(
    teacherId: string,
    dayOfWeek: DayOfWeek,
    startTime: string,
    endTime: string,
    termId: string,
    excludeSlotId: string | null,
  ) {
    const conflicts = await this.prisma.timeTableSlot.findMany({
      where: {
        teacher_id: teacherId,
        day_of_week: dayOfWeek,
        academic_term_id: termId,
        is_active: true,
        ...(excludeSlotId && { NOT: { id: excludeSlotId } }),
      },
    });

    for (const slot of conflicts) {
      if (
        this.timesOverlap(startTime, endTime, slot.start_time, slot.end_time)
      ) {
        throw new TeacherScheduleConflictException(
          dayOfWeek,
          startTime,
          endTime,
        );
      }
    }
  }

  // Checks if a class has a time conflict with existing slots
  private async checkClassConflict(
    classId: string,
    dayOfWeek: DayOfWeek,
    startTime: string,
    endTime: string,
    termId: string,
    excludeSlotId: string | null,
  ) {
    const conflicts = await this.prisma.timeTableSlot.findMany({
      where: {
        class_id: classId,
        day_of_week: dayOfWeek,
        academic_term_id: termId,
        is_active: true,
        ...(excludeSlotId && { NOT: { id: excludeSlotId } }),
      },
    });

    for (const slot of conflicts) {
      if (
        this.timesOverlap(startTime, endTime, slot.start_time, slot.end_time)
      ) {
        throw new ClassScheduleConflictException(dayOfWeek, startTime, endTime);
      }
    }
  }

  // Checks if teacher has any overlapping tutorial classes
  private async checkTeacherTutorialConflict(
    teacherId: string,
    start: Date,
    end: Date,
    excludeTutorialSlotId: string | null,
  ) {
    const conflicts = await this.prisma.tutorialClass.findMany({
      where: {
        teacher_id: teacherId,
        ...(excludeTutorialSlotId && { NOT: { id: excludeTutorialSlotId } }),
        // Check if the tutorial class overlaps with the given time range
        AND: [
          {
            start_time: { lt: end },
            end_time: { gt: start },
          },
        ],
      },
    });

    if (conflicts.length > 0) {
      throw new TutorialTimeConflictException();
    }
  }

  // Time helpers
  // Converts "08:30" to total minutes (510) for easy comparison
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // Returns true if two time ranges overlap
  // Logic: A starts before B ends AND A ends after B starts
  private timesOverlap(
    aStart: string,
    aEnd: string,
    bStart: string,
    bEnd: string,
  ): boolean {
    const aS = this.timeToMinutes(aStart);
    const aE = this.timeToMinutes(aEnd);
    const bS = this.timeToMinutes(bStart);
    const bE = this.timeToMinutes(bEnd);

    return aS < bE && aE > bS;
  }

  private validateTimeRange(startTime: string, endTime: string) {
    if (this.timeToMinutes(startTime) >= this.timeToMinutes(endTime)) {
      throw new InvalidTimeRangeException();
    }
  }

  private validateSchoolHours(startTime: string, endTime: string) {
    const open = this.timeToMinutes(SCHOOL_OPEN);
    const close = this.timeToMinutes(SCHOOL_CLOSE);
    const start = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);

    if (start < open || end > close) {
      throw new SlotNotInSchoolHoursException(SCHOOL_OPEN, SCHOOL_CLOSE);
    }
  }

  // Validation Helpers
  private async validateSlotExists(slotId: string, tenantId: string) {
    const slot = await this.prisma.timeTableSlot.findFirst({
      where: { id: slotId, tenant_id: tenantId },
    });
    if (!slot) throw new TimetableSlotNotFoundException();
    return slot;
  }

  private async validateTutorialExists(
    tutorialId: string,
    tenantId: string,
    teacherUserId: string,
  ) {
    const tutorial = await this.prisma.tutorialClass.findFirst({
      where: { id: tutorialId, tenant_id: tenantId, teacher_id: teacherUserId },
    });
    if (!tutorial) throw new TutorialClassNotFoundException();
    return tutorial;
  }

  private async validateClassExists(classId: string, tenantId: string) {
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, tenant_id: tenantId },
    });
    if (!cls) throw new ClassNotFoundException();
    return cls;
  }

  private async validateTeacherExists(teacherId: string, tenantId: string) {
    const teacher = await this.prisma.user.findFirst({
      where: { id: teacherId, tenant_id: tenantId, role: 'TEACHER' },
    });
    if (!teacher) throw new UserNotFoundException();
    return teacher;
  }

  private async validateSubjectAssignedToClass(
    subjectId: string,
    classId: string,
  ) {
    const assigned = await this.prisma.classSubject.findFirst({
      where: { class_id: classId, subject_id: subjectId },
    });
    if (!assigned) throw new SubjectNotAssignedException();
    return assigned;
  }

  // Response Helpers
  // Defines what related data is included with every slot response
  private slotIncludes() {
    return {
      class: {
        select: { id: true, name: true, level: true },
      },
      subject: {
        select: { id: true, name: true, code: true, title: true },
      },
    } as const;
  }

  // Groups a flat list of slots into a day-keyed object
  private groupByDay(slots: any[]) {
    const days = Object.values(DayOfWeek);
    const grouped: Record<string, any[]> = {};

    for (const day of days) {
      grouped[day] = slots.filter((s) => s.day_of_week === day);
    }

    return grouped;
  }
}
