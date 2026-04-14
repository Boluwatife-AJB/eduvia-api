import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/database/prisma.service';
import { AssessmentSubmissionNotFoundException } from 'src/errors/exceptions/business.exception';
import { Assessment, AssessmentSubmission } from 'src/generated/prisma/client';
import { CAComponent, QuestionType } from 'src/generated/prisma/enums';
import { QUEUE_NAMES } from 'src/queue/queue.module';
import { ResultEngineService } from 'src/result-engine/result-engine.service';
import { SchoolConfigService } from 'src/school-config/school-config.service';
import { GradeScale } from './interfaces/assessment.interface';
import { GpaCalculatorService } from './gpa-calculator.service';

@Injectable()
export class GradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: SchoolConfigService,
    private readonly resultEngineService: ResultEngineService,
    private readonly gpaCalc: GpaCalculatorService,
    @InjectQueue(QUEUE_NAMES.GRADING)
    private readonly gradingQueue: Queue,
  ) {}

  async queueAutoGrading(submissionId: string): Promise<void> {
    await this.gradingQueue.add(
      'auto-grade',
      { submission_id: submissionId },
      {
        jobId: `grade-${submissionId}`,
        priority: 1,
      },
    );
  }

  async autoGradeSubmission(submissionId: string): Promise<void> {
    const submission = await this.prisma.assessmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        answers: {
          include: {
            question: true,
          },
        },
        assessment: true,
      },
    });

    if (!submission) {
      throw new AssessmentSubmissionNotFoundException();
    }

    let autoScore = 0;
    const answerUpdate: Promise<any>[] = [];

    for (const answer of submission.answers) {
      const question = answer.question;

      if (!question.is_auto_gradable) continue;

      let marksAwarded = 0;
      let isCorrect = false;

      if (
        question.type === QuestionType.MULTIPLE_CHOICE ||
        question.type === QuestionType.TRUE_FALSE
      ) {
        const options = question.options as Array<{
          id: string;
          is_correct: boolean;
        }>;

        const correctOption = options.find((option) => option.is_correct);
        isCorrect = correctOption?.id === answer.selected_option_id;
        marksAwarded = isCorrect ? question.marks : 0;
      }

      if (question.type === QuestionType.FILL_IN_THE_BLANK) {
        const acceptedAnswers =
          (question.accepted_answers as Array<string>) ?? [
            question.correct_answer,
          ];
        isCorrect = acceptedAnswers
          .map((answer) => answer.toLowerCase().trim())
          .includes(answer.text_answer?.toLowerCase().trim() ?? '');
        marksAwarded = isCorrect ? question.marks : 0;
      }

      autoScore += marksAwarded;

      answerUpdate.push(
        this.prisma.submissionAnswer.update({
          where: { id: answer.id },
          data: {
            marks_awarded: marksAwarded,
            is_correct: isCorrect,
            graded_at: new Date(),
          },
        }),
      );
    }

    await Promise.all(answerUpdate);

    const hasManualQuestions = submission.answers.some(
      (answer) => !answer.question.is_auto_gradable,
    );

    if (!hasManualQuestions) {
      await this.finaliseSubmissionScore(submissionId, autoScore, null);
    } else {
      await this.prisma.assessmentSubmission.update({
        where: { id: submissionId },
        data: { auto_scores: autoScore },
      });
    }
  }

  async gradeManualAnswers(
    submissionId: string,
    teacherId: string,
    grades: Array<{
      answer_id: string;
      marks_awarded: number;
      comment?: string;
    }>,
  ) {
    const submission = await this.prisma.assessmentSubmission.findUnique({
      where: { id: submissionId },
    });

    let manualScore = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const grade of grades) {
        const answer = await tx.submissionAnswer.findUnique({
          where: { id: grade.answer_id },
          include: { question: true },
        });

        if (grade.marks_awarded > (answer?.question?.marks ?? 0)) {
          throw new BadRequestException(
            'Marks awarded cannot be greater than the question marks',
          );
        }

        manualScore += grade.marks_awarded;

        await tx.submissionAnswer.update({
          where: { id: grade.answer_id },
          data: {
            marks_awarded: grade.marks_awarded,
            teacher_comment: grade.comment,
            graded_by: teacherId,
            graded_at: new Date(),
          },
        });
      }
    });

    await this.finaliseSubmissionScore(
      submissionId,
      submission?.auto_scores ?? 0,
      manualScore,
    );
  }

  // Finalise Submission Score
  async finaliseSubmissionScore(
    submissionId: string,
    autoScore: number,
    manualScore: number | null,
  ) {
    const submission = await this.prisma.assessmentSubmission.findUnique({
      where: { id: submissionId },
      include: { assessment: true },
    });

    if (!submission) {
      throw new AssessmentSubmissionNotFoundException();
    }

    const tenantId = submission.tenant_id;
    const config = await this.configService.getConfig(tenantId);
    const totalScore = autoScore + (manualScore ?? 0);
    const maxScore = submission.assessment.total_marks;
    const percentageScore = (totalScore / maxScore) * 100;
    const passMark = submission.assessment.pass_mark ?? config.pass_mark;

    // Apply school grading scale
    const { grade, grade_points, remark } = this.applyGradeScale(
      percentageScore,
      config.grading_scale as unknown as GradeScale[],
    );

    await this.prisma.assessmentSubmission.update({
      where: { id: submissionId },
      data: {
        auto_scores: autoScore,
        manual_scores: manualScore,
        total_scores: totalScore,
        percentage_score: Math.round(percentageScore * 100) / 100,
        grade,
        grade_points,
        is_passed: percentageScore >= (passMark ?? 40),
        graded_by: 'system',
        graded_at: new Date(),
        feedback: remark,
      },
    });

    // If this assessment contributes to CA, update the subject registration
    if (submission.assessment.is_exam_component) {
      await this.updateSubjectScore(submission, percentageScore);
    }
  }

  // Apply Grading Scale
  private applyGradeScale(percentage: number, scale: GradeScale[]) {
    return this.gpaCalc.applyGradeScale(percentage, scale);
  }

  // UPDATE SUBJECT SCORE FROM ASSESSMENT

  private async updateSubjectScore(
    submission: AssessmentSubmission & { assessment: Assessment },
    percentage: number,
  ) {
    const { assessment } = submission;
    // const config = await this.configService.getConfig(submission.tenant_id);

    const reg = await this.prisma.subjectRegistration.findFirst({
      where: {
        student_id: submission.student_id,
        subject_id: assessment.subject_id,
        term_id: assessment.term_id,
      },
    });

    if (!reg) return;

    // Map CAComponent to the correct score field
    const caField = this.caComponentToField(assessment.ca_component);

    if (caField) {
      await this.prisma.subjectRegistration.update({
        where: { id: reg.id },
        data: { [caField]: percentage },
      });
    }

    // Recalculate CA total and final score
    await this.resultEngineService.recalculateSubjectResult(reg.id);
  }

  private caComponentToField(component: CAComponent | null): string | null {
    const map: Record<CAComponent, string> = {
      CA1: 'ca1_score',
      CA2: 'ca2_score',
      CA3: 'ca3_score',
      CA4: 'ca4_score',
      CA5: 'ca5_score',
    };
    return component ? map[component] : null;
  }
}
