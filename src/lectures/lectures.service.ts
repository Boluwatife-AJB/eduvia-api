import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from 'src/database/prisma.service';
import { AppException } from 'src/errors/exceptions/app.exception';
import {
  ActiveTermRequiredException,
  LectureAccessDeniedException,
  LectureAlreadyPublishedException,
  LectureNotFoundException,
  SubjectNotAssignedException,
  TeacherProfileNotFoundException,
} from 'src/errors/exceptions/business.exception';
import { ErrorCode } from 'src/errors/types/error-codes.enum';
import { LectureContentType, LectureStatus } from 'src/generated/prisma/enums';
import { UploadService } from 'src/upload/upload.service';
import {
  CreateLectureDto,
  QueryLecturesAsStudentDto,
  QueryLecturesDto,
  UpdateLectureDto,
  UpdateViewProgressDto,
} from './dto/lecture.dto.ts';

// Fields returned with every lecture response
const LECTURE_SELECT = {
  id: true,
  title: true,
  description: true,
  content_type: true,
  status: true,
  file_url: true,
  external_url: true,
  text_content: true,
  duration_mins: true,
  file_size: true,
  order: true,
  published_at: true,
  created_at: true,
  subject: { select: { id: true, name: true, code: true } },
  class: { select: { id: true, name: true } },
  term: { select: { id: true, name: true } },
  // Never return fileKey in responses — it is an internal storage detail
};

@Injectable()
export class LecturesService {
  private readonly logger = new Logger(LecturesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly uploadService: UploadService,
  ) {}

  // Create lecture
  async createLecture(teacherUserId: string, dto: CreateLectureDto) {
    const tenantId = this.cls.get<string>('tenantId');
    const teacherProfileId = await this.resolveTeacherProfileId(
      teacherUserId,
      tenantId,
    );

    const currentTerm = await this.prisma.academicTerm.findFirst({
      where: { tenant_id: tenantId, is_current: true },
    });
    if (!currentTerm) throw new ActiveTermRequiredException();

    // Verify that the subject is assigned to the class
    const classSubject = await this.prisma.classSubject.findFirst({
      where: { class_id: dto.class_id, subject_id: dto.subject_id },
    });
    if (!classSubject) throw new SubjectNotAssignedException();

    const lecture = await this.prisma.lecture.create({
      data: {
        tenant_id: tenantId,
        teacher_id: teacherProfileId,
        subject_id: dto.subject_id,
        class_id: dto.class_id,
        academic_term_id: currentTerm.id,
        title: dto.title,
        description: dto.description,
        content_type: dto.content_type,
        status: LectureStatus.DRAFT,
        file_url: dto.file_url ?? null,
        external_url: dto.external_url ?? null,
        text_content: dto.text_content ?? null,
        duration_mins: dto.duration_mins ?? null,
        order: dto.order ?? 0,
      },
      select: LECTURE_SELECT,
    });

    this.logger.log(
      `Lecture '${dto.title}' created as DRAFT by teacher profile '${teacherProfileId}' (user '${teacherUserId}')`,
    );

    return lecture;
  }

  // Publish a lecture
  async publishLecture(teacherUserId: string, lectureId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    const lecture = await this.validateLectureOwnership(
      lectureId,
      tenantId,
      teacherUserId,
    );

    if (lecture.status === LectureStatus.PUBLISHED) {
      throw new LectureAlreadyPublishedException();
    }

    const requiresFile =
      lecture.content_type !== LectureContentType.TEXT &&
      lecture.content_type !== LectureContentType.LINK;

    // console.log('requiresFile', requiresFile);
    // console.log('lecture.file_key', lecture.file_key);

    if (requiresFile && !lecture.file_url) {
      throw new AppException({
        code: ErrorCode.FILE_NOT_FOUND_IN_STORAGE,
        message: 'Cannot publish a lecture without a confirmed file upload.',
        statusCode: HttpStatus.BAD_REQUEST,
        action: 'Upload the file and confirm it before publishing.',
      });
    }

    const updated = await this.prisma.lecture.update({
      where: { id: lectureId },
      data: { status: LectureStatus.PUBLISHED, published_at: new Date() },
      select: LECTURE_SELECT,
    });

    this.logger.log(
      `Lecture '${updated.title}' published by teacher '${teacherUserId}'`,
    );

    return {
      ...updated,
      message: 'Lecture published successfully.',
    };
  }

  // Unpublish a lecture
  async unpublishLecture(teacherUserId: string, lectureId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    const lecture = await this.validateLectureOwnership(
      lectureId,
      tenantId,
      teacherUserId,
    );

    if (lecture.status === LectureStatus.UNPUBLISHED) {
      throw new AppException({
        code: ErrorCode.INVALID_INPUT,
        message: 'Lecture is already unpublished.',
        statusCode: HttpStatus.BAD_REQUEST,
        action: 'Please publish the lecture before unpublishing.',
      });
    }

    await this.prisma.lecture.update({
      where: { id: lectureId },
      data: { status: LectureStatus.UNPUBLISHED },
    });

    this.logger.log(
      `Lecture '${lecture.title}' unpublished by teacher '${teacherUserId}'`,
    );
    return {
      ...lecture,
      message: 'Lecture unpublished successfully.',
    };
  }

  // Archive a lecture
  async archiveLecture(teacherUserId: string, lectureId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.validateLectureOwnership(lectureId, tenantId, teacherUserId);

    return this.prisma.lecture.update({
      where: { id: lectureId },
      data: { status: LectureStatus.ARCHIVED },
      select: LECTURE_SELECT,
    });
  }

  //  Update a lecture
  async updateLecture(
    teacherUserId: string,
    lectureId: string,
    dto: UpdateLectureDto,
  ) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.validateLectureOwnership(lectureId, tenantId, teacherUserId);

    return this.prisma.lecture.update({
      where: { id: lectureId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.text_content !== undefined && {
          text_content: dto.text_content,
        }),
        ...(dto.external_url !== undefined && {
          external_url: dto.external_url,
        }),
        ...(dto.duration_mins !== undefined && {
          duration_mins: dto.duration_mins,
        }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
      select: LECTURE_SELECT,
    });
  }

  // Delete a lecture
  async deleteLecture(teacherUserId: string, lectureId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    const lecture = await this.validateLectureOwnership(
      lectureId,
      tenantId,
      teacherUserId,
    );

    if (lecture.file_key) {
      await this.uploadService.deleteFile(lecture.file_key);
    }

    await this.prisma.lecture.delete({
      where: { id: lectureId },
    });

    this.logger.log(
      `Lecture '${lectureId}' deleted by teacher '${teacherUserId}'`,
    );

    return {
      message: 'Lecture deleted successfully.',
    };
  }

  // Fetch all lectures for a teacher including archived lectures and drafts
  async getTeacherLectures(teacherUserId: string, query: QueryLecturesDto) {
    const tenantId = this.cls.get<string>('tenantId');
    const teacherProfileId = await this.resolveTeacherProfileId(
      teacherUserId,
      tenantId,
    );

    return this.prisma.lecture.findMany({
      where: {
        tenant_id: tenantId,
        teacher_id: teacherProfileId,
        ...(query.subject_id && { subject_id: query.subject_id }),
        ...(query.class_id && { class_id: query.class_id }),
        ...(query.content_type && { content_type: query.content_type }),
      },
      orderBy: [
        { order: 'asc' },
        { subject_id: 'asc' },
        { created_at: 'desc' },
      ],
      select: LECTURE_SELECT,
    });
  }

  // Fetch a single lecture by lecture id
  async getTeacherLectureById(lectureId: string, teacherUserId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    const teacherProfileId = await this.resolveTeacherProfileId(
      teacherUserId,
      tenantId,
    );

    const lecture = await this.prisma.lecture.findFirst({
      where: {
        id: lectureId,
        tenant_id: tenantId,
        teacher_id: teacherProfileId,
      },
      select: {
        ...LECTURE_SELECT,
        views: {
          select: {
            id: true,
            student_id: true,
            viewed_at: true,
            progress_percentage: true,
          },
        },
      },
    });

    if (!lecture) throw new LectureNotFoundException();
    return lecture;
  }

  // Fetch lectures for a student: Student can only see lectures that are published, assigned to their class and registered for the subject
  async getStudentLectures(
    studentUserId: string,
    query: QueryLecturesAsStudentDto,
  ) {
    const tenantId = this.cls.get<string>('tenantId');

    const studentProfile = await this.prisma.studentProfile.findFirst({
      where: { user_id: studentUserId, tenant_id: tenantId },
    });
    if (!studentProfile?.class_id) {
      throw new AppException({
        code: ErrorCode.STUDENT_NOT_IN_CLASS,
        message: 'Student is not assigned to any class.',
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

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

    const lectures = await this.prisma.lecture.findMany({
      where: {
        tenant_id: tenantId,
        class_id: studentProfile.class_id,
        academic_term_id: currentTerm.id,
        subject_id: { in: registeredSubjectIds },
        status: LectureStatus.PUBLISHED,
        ...(query.subject_id && { subject_id: query.subject_id }),
        ...(query.content_type && { content_type: query.content_type }),
      },
      orderBy: [
        { order: 'asc' },
        { subject_id: 'asc' },
        { created_at: 'desc' },
      ],
      select: {
        ...LECTURE_SELECT,
        views: {
          where: { student_id: studentUserId },
          select: {
            id: true,
            viewed_at: true,
            progress_percentage: true,
          },
        },
      },
    });

    return lectures.map((lecture) => ({
      ...lecture,
      viewed: lecture.views.length > 0,
      viewed_at: lecture.views.length > 0 ? lecture.views[0].viewed_at : null,
      progress_percentage:
        lecture.views.length > 0 ? lecture.views[0].progress_percentage : 0,
    }));
  }

  // Fetch a single lecture by lecture id for a student
  async getStudentLectureById(lectureId: string, studentUserId: string) {
    const tenantId = this.cls.get<string>('tenantId');

    const lecture = await this.prisma.lecture.findFirst({
      where: {
        id: lectureId,
        tenant_id: tenantId,
        status: LectureStatus.PUBLISHED,
      },
      select: {
        ...LECTURE_SELECT,
        file_key: false,
      },
    });

    if (!lecture) throw new LectureNotFoundException();
    // Validate the student is registered for the subject this lecture belongs to
    await this.validateStudentCanAccessLecture(studentUserId, tenantId, {
      subject_id: lecture.subject.id,
      class_id: lecture.class.id,
    });

    // Record or update the student's view of the lecture
    await this.prisma.lectureView.upsert({
      where: {
        lecture_id_student_id: {
          lecture_id: lectureId,
          student_id: studentUserId,
        },
      },
      update: { viewed_at: new Date() },
      create: {
        tenant_id: tenantId,
        lecture_id: lectureId,
        student_id: studentUserId,
        progress_percentage: 0,
      },
    });

    return lecture;
  }

  // Progress tracking
  async updateViewProgress(
    studentUserId: string,
    lectureId: string,
    dto: UpdateViewProgressDto,
  ) {
    const tenantId = this.cls.get<string>('tenantId');

    await this.prisma.lectureView.upsert({
      where: {
        lecture_id_student_id: {
          lecture_id: lectureId,
          student_id: studentUserId,
        },
      },
      create: {
        tenant_id: tenantId,
        lecture_id: lectureId,
        student_id: studentUserId,
        progress_percentage: dto.progress_percentage,
      },
      update: { progress_percentage: dto.progress_percentage },
    });
    return {
      message: 'View progress updated successfully.',
      progress_percentage: dto.progress_percentage,
    };
  }

  // PRIVATE HELPER METHODS
  /** JWT `sub` / User.id → TeacherProfile.id (Lecture.teacher_id FK). */
  private async resolveTeacherProfileId(
    userId: string,
    tenantId: string,
  ): Promise<string> {
    const profile = await this.prisma.teacherProfile.findFirst({
      where: { user_id: userId, tenant_id: tenantId },
      select: { id: true },
    });
    if (!profile) throw new TeacherProfileNotFoundException();
    return profile.id;
  }

  private async validateLectureOwnership(
    lectureId: string,
    tenantId: string,
    teacherUserId: string,
  ) {
    const teacherProfileId = await this.resolveTeacherProfileId(
      teacherUserId,
      tenantId,
    );
    const lecture = await this.prisma.lecture.findFirst({
      where: {
        id: lectureId,
        tenant_id: tenantId,
        teacher_id: teacherProfileId,
      },
    });
    if (!lecture) throw new LectureNotFoundException();

    return lecture;
  }

  private async validateStudentCanAccessLecture(
    studentUserId: string,
    tenantId: string,
    lecture: { subject_id: string; class_id: string },
  ) {
    const studentProfile = await this.prisma.studentProfile.findFirst({
      where: { user_id: studentUserId, tenant_id: tenantId },
    });
    if (studentProfile?.class_id !== lecture.class_id) {
      throw new LectureAccessDeniedException();
    }

    const currentTerm = await this.prisma.academicTerm.findFirst({
      where: { tenant_id: tenantId, is_current: true },
    });
    if (!currentTerm) throw new ActiveTermRequiredException();

    const registeredSubjects =
      await this.prisma.studentSubjectRegistration.findFirst({
        where: {
          student_id: studentProfile.id,
          term_id: currentTerm.id,
          classSubject: { subject_id: lecture.subject_id },
        },
      });

    if (!registeredSubjects) throw new LectureAccessDeniedException();
  }
}
