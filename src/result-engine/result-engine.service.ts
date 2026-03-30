import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { GpaCalculatorService } from 'src/assessment/gpa-calculator.service';
import { GradeScale } from 'src/assessment/interfaces/assessment.interface';
import { PrismaService } from 'src/database/prisma.service';
import {
  SubjectRegistrationNotFoundException,
  UserNotFoundException,
} from 'src/errors/exceptions/business.exception';
import { SubjectRegistration } from 'src/generated/prisma/client';
import { SchoolConfigService } from 'src/school-config/school-config.service';

@Injectable()
export class ResultEngineService {
  private readonly logger = new Logger(ResultEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: SchoolConfigService,
    private readonly gpaCalc: GpaCalculatorService,
  ) {}

  // Recalculate Subject Result
  async recalculateSubjectResult(subjectRegistrationId: string) {
    const reg = await this.prisma.subjectRegistration.findUnique({
      where: { id: subjectRegistrationId },
    });

    if (!reg) throw new SubjectRegistrationNotFoundException();

    const config = await this.configService.getConfig(reg.tenant_id);

    const { ca_weight, exam_weight } = config;

    if (!ca_weight || !exam_weight) {
      throw new BadRequestException('CA weight and exam weight must be set');
    } else if (ca_weight + exam_weight !== 100) {
      throw new BadRequestException(
        'CA weight and exam weight must sum to 100',
      );
    }

    const caScores = [
      reg.ca1_score,
      reg.ca2_score,
      reg.ca3_score,
      reg.ca4_score,
      reg.ca5_score,
    ].filter((score) => score !== null);

    const caRawAverage =
      caScores.length > 0
        ? caScores.reduce((sum, score) => sum + score, 0) / caScores.length
        : 0;

    const caTotal = (caRawAverage / 100) * ca_weight;

    const examScore =
      reg.exam_score !== null ? (reg.exam_score / 100) * exam_weight : 0;

    const finalScore = Math.round((caTotal + examScore) * 100) / 100;

    // Apply school grading scale
    const { grade, grade_points, remark } = this.applyGradeScale(
      finalScore,
      config.grading_scale as unknown as GradeScale[],
    );

    // Persist
    await this.prisma.subjectRegistration.update({
      where: { id: subjectRegistrationId },
      data: {
        ca_total_score: caTotal,
        grade,
        total_score: finalScore,
        grade_points,
        remark,
        is_passed: grade_points >= (config.pass_mark ?? 40),
      },
    });

    await this.recalculateTermResult(reg.student_id, reg.term_id);
  }

  // Recalculate Term Result
  async recalculateTermResult(studentId: string, termId: string) {
    const tenantId = await this.getTenantId(studentId);

    const subjects = await this.prisma.subjectRegistration.findMany({
      where: { student_id: studentId, term_id: termId },
      orderBy: { total_score: 'desc' },
    });

    if (subjects.length === 0) return;

    const totalScore = subjects.reduce(
      (sum, subject) => sum + (subject.total_score ?? 0),
      0,
    );
    const totalCreditUnits = subjects.reduce(
      (sum, subject) => sum + subject.credit_units,
      0,
    );
    const average = totalScore / subjects.length;

    // Calculate term GPA using weighted average
    const termGPA = this.calculateWeightedGPA(subjects);

    // Calculate position within class
    const position = await this.calculateClassPosition(studentId, termId);

    // const existing = await this.prisma.termResult.findFirst({
    //   where: { student_id: studentId, term_id: termId },
    // });

    // if (existing) {
    //   await this.prisma.termResult.update({
    //     where: { id: existing.id },
    //     data: {
    //       total_score: totalScore,
    //       average: Math.round(average * 100) / 100,
    //       total_credit_units: totalCreditUnits,
    //       term_gpa: termGPA,
    //       position: position.rank,
    //       out_of: position.total,
    //     },
    //   });
    // }

    await this.prisma.termResult.upsert({
      where: { student_id_term_id: { student_id: studentId, term_id: termId } },
      create: {
        tenant_id: tenantId,
        student_id: studentId,
        term_id: termId,
        class_id: subjects[0]?.class_id,
        session_id: subjects[0]?.session_id,
        total_score: totalScore,
        average: Math.round(average * 100) / 100,
        total_credit_units: totalCreditUnits,
        term_gpa: termGPA,
        position: position.rank,
        out_of: position.total,
      },
      update: {
        total_score: totalScore,
        average: Math.round(average * 100) / 100,
        total_credit_units: totalCreditUnits,
        term_gpa: termGPA,
        position: position.rank,
        out_of: position.total,
      },
    });

    // Update cumulative result
    await this.recalculateCGPA(studentId);
  }

  // CALCULATE WEIGHTED GPA
  calculateWeightedGPA(subjects: SubjectRegistration[]): number {
    return this.gpaCalc.calculateWeightedGPA(subjects);
  }

  // CALCULATE CGPA
  async recalculateCGPA(studentId: string) {
    const tenantId = await this.getTenantId(studentId);

    const termResults = await this.prisma.termResult.findMany({
      where: { student_id: studentId },
    });

    if (termResults.length === 0) return;

    const allSubjects = await this.prisma.subjectRegistration.findMany({
      where: { student_id: studentId },
    });

    const totalWeighted = allSubjects.reduce(
      (sum, subject) =>
        sum + (subject.grade_points ?? 0) * subject.credit_units,
      0,
    );
    const totalCredits = allSubjects.reduce(
      (sum, subject) => sum + subject.credit_units,
      0,
    );
    const lifetimeCGPA =
      totalCredits > 0
        ? Math.round((totalWeighted / totalCredits) * 100) / 100
        : 0;

    // Group by session for session CGPA
    const bySession = this.groupBySession(allSubjects);

    for (const [sessionId, sessionSubjects] of Object.entries(bySession)) {
      const sessionWeighted = sessionSubjects.reduce(
        (sum, subject) =>
          sum + (subject.grade_points ?? 0) * subject.credit_units,
        0,
      );
      const sessionCredits = sessionSubjects.reduce(
        (sum, subject) => sum + subject.credit_units,
        0,
      );
      const sessionCGPA =
        sessionCredits > 0
          ? Math.round((sessionWeighted / sessionCredits) * 100) / 100
          : 0;

      await this.prisma.cumulativeResult.upsert({
        where: {
          student_id_session_id: {
            student_id: studentId,
            session_id: sessionId,
          },
        },
        create: {
          tenant_id: tenantId,
          student_id: studentId,
          session_id: sessionId,
          session_cgpa: sessionCGPA,
          lifetime_cgpa: lifetimeCGPA,
          total_credit_units_earned: sessionCredits,
          total_credit_units_attempted: totalCredits,
        },
        update: {
          session_cgpa: sessionCGPA,
          lifetime_cgpa: lifetimeCGPA,
          total_credit_units_earned: sessionCredits,
          total_credit_units_attempted: totalCredits,
        },
      });
    }
  }

  // PRIVATE HELPER METHODS

  private async calculateClassPosition(
    studentId: string,
    termId: string,
  ): Promise<{ rank: number; total: number }> {
    // Get the student's class
    const profile = await this.prisma.studentProfile.findFirst({
      where: { user_id: studentId },
    });

    if (!profile) throw new UserNotFoundException();

    // Get all students in the same class
    const classStudents = await this.prisma.studentProfile.findMany({
      where: { class_id: profile.class_id },
      select: { user_id: true },
    });

    const studentIds = classStudents.map((s) => s.user_id);

    // Get all term averages for this class
    const classResults = await this.prisma.termResult.findMany({
      where: { student_id: { in: studentIds }, term_id: termId },
      select: { student_id: true, average: true },
    });

    // Sort by average descending, assign rank
    const sorted = [...classResults].sort(
      (a, b) => (b.average ?? 0) - (a.average ?? 0),
    );

    const rank = sorted.findIndex((r) => r.student_id === studentId) + 1;
    const total = sorted.length;

    return { rank: rank || total, total };
  }

  private applyGradeScale(percentage: number, scale: GradeScale[]) {
    return this.gpaCalc.applyGradeScale(percentage, scale);
  }

  private groupBySession(
    subjects: Array<{
      session_id: string;
      grade_points: number | null;
      credit_units: number;
    }>,
  ): Record<string, typeof subjects> {
    return subjects.reduce(
      (acc, subject) => {
        const key = subject.session_id;
        if (!acc[key]) acc[key] = [];
        acc[key].push(subject);
        return acc;
      },
      {} as Record<string, typeof subjects>,
    );
  }

  private async getTenantId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tenant_id: true },
    });

    if (!user) throw new UserNotFoundException();
    return user.tenant_id;
  }
}
