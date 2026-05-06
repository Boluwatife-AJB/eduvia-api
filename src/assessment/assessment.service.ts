import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ApprovalWorkflowService } from 'src/approval/approval-workflow.service';
import { PrismaService } from 'src/database/prisma.service';
import {
  Assessment,
  AssessmentQuestion,
  AssessmentStatus,
  AssessmentType,
  QuestionType,
  UserRole,
} from 'src/generated/prisma/client';
import { NotificationsService } from 'src/notifications/notifications.service';
import { SchoolConfigService } from 'src/school-config/school-config.service';
import {
  CreateAssessmentDto,
  UpdateAssessmentDto,
} from './dto/create-assessment.dto';
import { GradingService } from './grading.service';
import { SubmitAnswerItemDto } from './dto/submit-answer.dto';
import {
  ActiveTermRequiredException,
  AssessmentEndedException,
  AssessmentLateSubmissionException,
  AssessmentMaxAttemptsReachedException,
  AssessmentNotStartedException,
} from 'src/errors/exceptions/business.exception';

@Injectable()
export class AssessmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly schoolConfig: SchoolConfigService,
    private readonly approval: ApprovalWorkflowService,
    private readonly grading: GradingService,
    private readonly notify: NotificationsService,
  ) {}

  // Create assessment
  async createAssessment(dto: CreateAssessmentDto, teacherUserId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.schoolConfig.getConfig(tenantId);

    const {
      questions,
      teacher_id,
      term_id: dtoTermId,
      ...assessmentFields
    } = dto;
    void teacher_id;

    let term_id = dtoTermId;
    if (!term_id) {
      const currentTerm = await this.prisma.academicTerm.findFirst({
        where: { tenant_id: tenantId, is_current: true },
      });
      if (!currentTerm) throw new ActiveTermRequiredException();
      term_id = currentTerm.id;
    }

    //TODO: Verify that the teacher is assigned to the subject

    // TODO: Validate CA and Exam weights are configured, if this is a scored assessment
    if (dto.is_exam_component) {
      await this.schoolConfig.validateExamWeightConfig(tenantId);
    }

    // TODO: Teacher should be able to upload an image
    const assessment = await this.prisma.assessment.create({
      data: {
        ...assessmentFields,
        tenant_id: tenantId,
        teacher_id: [teacherUserId],
        term_id,
        status: AssessmentStatus.DRAFT,
        total_marks: questions.reduce(
          (sum, question) => sum + question.marks,
          0,
        ),
      },
    });

    const autoGradableTypes: QuestionType[] = [
      QuestionType.MULTIPLE_CHOICE,
      QuestionType.TRUE_FALSE,
      QuestionType.FILL_IN_THE_BLANK,
    ];

    // Create questions in bulk
    await this.prisma.assessmentQuestion.createMany({
      data: questions.map((question, index) => ({
        ...question,
        tenant_id: tenantId,
        assessment_id: assessment.id,
        options: question.options?.map((opt) => ({ ...opt })),
        order: index + 1,
        is_auto_gradable: autoGradableTypes.includes(question.type),
      })),
    });

    return this.findOne(assessment.id, UserRole.TEACHER);
  }

  // Publish assessment
  async publish(assessmentId: string, teacherUserId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    const assessment = await this.findOneInternal(assessmentId);
    const schoolConfig = await this.schoolConfig.getConfig(tenantId);

    this.assertTeacherOwns(assessment, teacherUserId);
    this.assertDraftStatus(assessment);
    await this.assertQuestionsExist(assessmentId);

    // EXAM type requires approval
    if (
      assessment.type === AssessmentType.EXAM &&
      schoolConfig.require_exam_approval
    ) {
      return this.approval.submitForApproval(
        assessmentId,
        'assessment',
        teacherUserId,
      );
    }
    return this.prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        status: AssessmentStatus.PUBLISHED,
        submitted_for_approval: new Date(),
      },
    });
  }

  // Start submission
  async startSubmission(assessmentId: string, studentId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    const assessment = await this.findOneInternal(assessmentId);

    // Validate assessment is within its time window
    this.validateTimeWindow(assessment);

    // Check attempt limit
    const existingSubmission = await this.prisma.assessmentSubmission.count({
      where: {
        assessment_id: assessmentId,
        student_id: studentId,
      },
    });

    if (existingSubmission >= (assessment.max_attempts ?? 1)) {
      throw new AssessmentMaxAttemptsReachedException();
    }

    // Fetch questions, shuffle if configured
    const questions = await this.prisma.assessmentQuestion.findMany({
      where: { assessment_id: assessmentId },
      orderBy: assessment.shuffle_questions ? undefined : { order: 'asc' },
      select: {
        id: true,
        type: true,
        question_text: true,
        question_image: true,
        marks: true,
        order: true,
        options: true,
        max_word_count: true,
        // !Never expose correctAnswer or isCorrect to student
      },
    });

    // For MCQ: shuffle options if configured
    const studentQuestions = questions.map((q) => ({
      ...q,
      options:
        assessment.shuffle_options && q.options
          ? this.shuffleArray(q.options as any[])
          : q.options,
    }));

    const submission = await this.prisma.assessmentSubmission.create({
      data: {
        tenant_id: tenantId,
        assessment_id: assessmentId,
        student_id: studentId,
        attempt_number: existingSubmission + 1, // Increment attempt number
        started_at: new Date(),
        is_submitted: false,
      },
    });

    return { submission, questions: studentQuestions };
  }

  // Submit Answers
  async submitAnswers(
    submissionId: string,
    studentId: string,
    answers: SubmitAnswerItemDto[],
  ) {
    const submission = await this.getActiveSubmission(submissionId, studentId);
    const assessment = await this.findOneInternal(submission.assessment_id);

    // Check if submission is late
    const isLate = assessment.end_time
      ? new Date() > assessment.end_time
      : false;

    if (isLate) {
      throw new AssessmentLateSubmissionException();
    }

    await this.prisma.$transaction(async (tx) => {
      for (const answer of answers) {
        await tx.submissionAnswer.upsert({
          where: {
            submission_id_question_id: {
              submission_id: submissionId,
              question_id: answer.question_id,
            },
          },
          create: {
            submission_id: submissionId,
            question_id: answer.question_id,
            tenant_id: submission.tenant_id,
            selected_option_id: answer.selected_option_id,
            text_answer: answer.text_answer,
          },
          update: {
            selected_option_id: answer.selected_option_id,
            text_answer: answer.text_answer,
          },
        });
      }

      // Mark submission as submitted
      await tx.assessmentSubmission.update({
        where: { id: submissionId },
        data: {
          is_submitted: true,
          submitted_at: new Date(),
          is_late: isLate,
          time_spent_mins: Math.floor(
            (Date.now() - submission.started_at.getTime()) / 1000,
          ),
        },
      });
    });

    // Trigger auto-grading for auto-gradable questions via queue
    await this.grading.queueAutoGrading(submissionId);

    return { message: 'Submission received successfully' };
  }

  // Fetch all assessments
  async findAll(
    user: { id: string; role: UserRole },
    classId: string,
    subjectId: string,
    status: string,
  ) {
    const tenantId = this.cls.get<string>('tenantId');
    const isTeacher = user.role === UserRole.TEACHER;

    const assessments = await this.prisma.assessment.findMany({
      where: {
        tenant_id: tenantId,
        ...(isTeacher && { teacher_id: { has: user.id } }),
        ...(classId && { class_id: classId }),
        ...(subjectId && { subject_id: subjectId }),
        ...(status && { status: status as AssessmentStatus }),
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true } },
        _count: {
          select: {
            assessmentQuestions: true,
            assessmentSubmissions: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Convert Prisma's camelCase count keys and denormalized teacher_id (user id strings)
    // into the response shape expected by the client.
    if (assessments.length === 0) return assessments;

    const teacherUserIds = [
      ...new Set(assessments.flatMap((a) => a.teacher_id ?? [])),
    ];

    const teacherUsers = await this.prisma.user.findMany({
      where: {
        tenant_id: tenantId,
        id: { in: teacherUserIds },
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        avatar: true,
      },
    });

    const teacherUserById = new Map(teacherUsers.map((u) => [u.id, u]));

    return assessments.map((assessment) => {
      const { _count, teacher_id, ...rest } = assessment;

      const teacherProfiles = (teacher_id ?? [])
        .map((userId) => teacherUserById.get(userId))
        .filter((u): u is (typeof teacherUsers)[number] => Boolean(u))
        .map((u) => ({
          first_name: u.first_name,
          last_name: u.last_name,
          user_id: u.id,
          profile_img: u.avatar,
        }));

      return {
        ...rest,
        teacher: teacherProfiles,
        _count: {
          assessment_questions: _count.assessmentQuestions,
          assessment_submissions: _count.assessmentSubmissions,
        },
      };
    });
  }

  async update(id: string, dto: UpdateAssessmentDto, teacherUserId: string) {
    const assessment = await this.findOneInternal(id);
    this.assertTeacherOwns(assessment, teacherUserId);
    this.assertDraftStatus(assessment);

    return this.prisma.assessment.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, teacherUserId: string) {
    const assessment = await this.findOneInternal(id);
    this.assertTeacherOwns(assessment, teacherUserId);
    this.assertDraftStatus(assessment);

    await this.prisma.assessment.delete({ where: { id } });
    return { message: 'Assessment deleted' };
  }

  async approveAssessment(id: string, approverId: string, comment?: string) {
    return this.approval.approve(id, 'assessment', approverId, comment);
  }

  async rejectAssessment(id: string, rejectorId: string, reason: string) {
    return this.approval.reject(id, 'assessment', rejectorId, reason);
  }

  async publishApprovedAssessment(id: string) {
    return this.approval.publishApproved(id);
  }

  async getSubmissions(assessmentId: string, status?: string) {
    return this.prisma.assessmentSubmission.findMany({
      where: {
        assessment_id: assessmentId,
        ...(status && { is_submitted: status === 'submitted' }),
      },
      include: {
        answers: {
          include: {
            question: {
              select: { type: true, marks: true, is_auto_gradable: true },
            },
          },
        },
      },
      orderBy: { submitted_at: 'desc' },
    });
  }

  async getSubmission(
    assessmentId: string,
    submissionId: string,
    user: { id: string; role: UserRole },
  ) {
    const submission = await this.prisma.assessmentSubmission.findFirst({
      where: { id: submissionId, assessment_id: assessmentId },
      include: {
        answers: { include: { question: true } },
        assessment: { select: { title: true, total_marks: true } },
      },
    });

    if (!submission) throw new NotFoundException('Submission not found');

    // Students can only see their own submission
    if (user.role === UserRole.STUDENT && submission.student_id !== user.id) {
      throw new ForbiddenException('Access denied');
    }

    return submission;
  }

  // PRIVATE HELPER METHODS
  private assertTeacherOwns(assessment: Assessment, teacherUserId: string) {
    const ids: string[] = assessment.teacher_id ?? [];
    if (!ids.includes(teacherUserId)) {
      throw new ForbiddenException(
        'You can only modify the assessment you created.',
      );
    }
  }

  private assertDraftStatus(assessment: Assessment) {
    if (assessment.status !== AssessmentStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot modify a ${assessment.status.toLowerCase()} assessment.`,
      );
    }
  }

  private async assertQuestionsExist(assessmentId: string) {
    const count = await this.prisma.assessmentQuestion.count({
      where: { assessment_id: assessmentId },
    });
    if (count === 0) {
      throw new BadRequestException(
        'Assessment must have at least one question.',
      );
    }
    return count;
  }

  private async getActiveSubmission(submissionId: string, studentId: string) {
    const submission = await this.prisma.assessmentSubmission.findFirst({
      where: { id: submissionId, student_id: studentId, is_submitted: false },
    });
    if (!submission) {
      throw new NotFoundException(
        'Active submission not found. It may have already been submitted.',
      );
    }
    return submission;
  }

  private async findOneInternal(id: string) {
    const tenantId = this.cls.get<string>('tenantId');

    const assessment = await this.prisma.assessment.findFirst({
      where: { id, tenant_id: tenantId },
      include: {
        assessmentQuestions: { orderBy: { order: 'asc' } },
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } },
        _count: { select: { assessmentSubmissions: true } },
      },
    });

    if (!assessment) {
      throw new NotFoundException('Assessment not found.');
    }

    return assessment;
  }

  async findOne(id: string, viewerRole?: UserRole) {
    const tenantId = this.cls.get<string>('tenantId');
    const assessment = await this.findOneInternal(id);

    const teacherUsers = await this.prisma.user.findMany({
      where: {
        tenant_id: tenantId,
        id: { in: assessment.teacher_id },
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        avatar: true,
      },
    });

    const teacherById = new Map(teacherUsers.map((u) => [u.id, u]));
    const teacher = (assessment.teacher_id ?? [])
      .map((teacherId) => teacherById.get(teacherId))
      .filter((u): u is (typeof teacherUsers)[number] => Boolean(u))
      .map((u) => ({
        id: u.id,
        first_name: u.first_name,
        last_name: u.last_name,
        profile_img: u.avatar,
      }));

    const { teacher_id, assessmentQuestions, ...rest } = assessment;
    void teacher_id;

    const assessmentQuestionsForViewer =
      viewerRole === UserRole.STUDENT
        ? this.redactQuestionAnswersFromStudent(assessmentQuestions)
        : assessmentQuestions;

    return {
      ...rest,
      assessmentQuestions: assessmentQuestionsForViewer,
      teacher,
      _count: {
        assessment_submissions: assessment._count.assessmentSubmissions,
      },
    };
  }

  /** Omits keyed answers and correctness flags MCQ/T-F options carry. */
  private redactQuestionAnswersFromStudent(questions: AssessmentQuestion[]) {
    return questions.map((q) => {
      const { correct_answer, accepted_answers, options, ...rest } = q;
      void correct_answer;
      void accepted_answers;

      let safeOptions = options;
      if (Array.isArray(options)) {
        safeOptions = options.map((item) => {
          if (
            item !== null &&
            typeof item === 'object' &&
            !Array.isArray(item) &&
            'is_correct' in item
          ) {
            const clone = {
              ...(item as Record<string, unknown>),
            } as Record<string, unknown>;
            delete clone.is_correct;
            return clone;
          }
          return item;
        }) as AssessmentQuestion['options'];
      }

      return { ...rest, options: safeOptions };
    });
  }

  // Auto-save for long exams
  async autoSave(
    submissionId: string,
    studentId: string,
    answers: SubmitAnswerItemDto[],
  ) {
    const submission = await this.getActiveSubmission(submissionId, studentId);

    await this.prisma.$transaction(
      answers.map((answer) =>
        this.prisma.submissionAnswer.upsert({
          where: {
            submission_id_question_id: {
              submission_id: submissionId,
              question_id: answer.question_id,
            },
          },
          create: {
            submission_id: submissionId,
            question_id: answer.question_id,
            tenant_id: submission.tenant_id,
            selected_option_id: answer.selected_option_id,
            text_answer: answer.text_answer,
          },
          update: {
            selected_option_id: answer.selected_option_id,
            text_answer: answer.text_answer,
          },
        }),
      ),
    );

    return { message: 'Progress saved' };
  }

  // PRIVATE HELPER METHODS
  private validateTimeWindow(assessment: Assessment) {
    const now = new Date();
    if (assessment.start_time && now < assessment.start_time) {
      throw new AssessmentNotStartedException();
    }
    if (assessment.end_time && now > assessment.end_time) {
      throw new AssessmentEndedException();
    }
  }

  private shuffleArray<T>(arr: T[]): T[] {
    return [...arr].sort(() => Math.random() - 0.5);
  }

  private async findPublished(assessmentId: string) {
    const tenantId = this.cls.get<string>('tenantId');

    const assessment = await this.prisma.assessment.findFirst({
      where: {
        id: assessmentId,
        tenant_id: tenantId,
        status: {
          in: [AssessmentStatus.PUBLISHED, AssessmentStatus.ONGOING],
        },
      },
    });

    if (!assessment) {
      throw new NotFoundException(
        'Assessment not found or is not currently available.',
      );
    }

    return assessment;
  }

  // private async validateExamWeightConfig(tenantId: string, schoolConfig: any) {
  //   // Delegates to SchoolConfigService which throws if weights are misconfigured
  //   await this.config.validateExamWeightConfig(tenantId);
  // }
}
