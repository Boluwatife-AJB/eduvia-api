import { Injectable } from '@nestjs/common';
import { GradeScale } from './interfaces/assessment.interface';

@Injectable()
export class GpaCalculatorService {
  // Weighted GPA Calculator
  calculateWeightedGPA(
    subjects: Array<{
      grade_points: number | null;
      credit_units: number;
      is_passed: boolean | null;
    }>,
  ): number {
    const eligible = subjects.filter((s) => s.grade_points !== null);

    if (eligible.length === 0) return 0;

    const weightedSum = eligible.reduce(
      (sum, subject) =>
        sum + (subject.grade_points ?? 0) * subject.credit_units,
      0,
    );
    const totalCredits = eligible.reduce(
      (sum, subject) => sum + subject.credit_units,
      0,
    );

    if (totalCredits === 0) return 0;

    return Math.round((weightedSum / totalCredits) * 100) / 100;
  }

  // Session GPA
  calculateSessionCGPA(
    subjects: Array<{
      grade_points: number | null;
      credit_units: number;
    }>,
  ): number {
    return this.calculateWeightedGPA(
      subjects.map((subject) => ({ ...subject, is_passed: null })),
    );
  }

  // Lifetime GPA
  calculateLifetimeCGPA(
    subjects: Array<{
      grade_points: number | null;
      credit_units: number;
    }>,
  ): number {
    return this.calculateWeightedGPA(
      subjects.map((subject) => ({ ...subject, is_passed: null })),
    );
  }

  classifyGPA(gpa: number, scale: 4 | 5): string {
    if (scale === 5) {
      if (gpa >= 4.5) return 'First Class';
      if (gpa >= 3.5) return 'Second Class Upper';
      if (gpa >= 2.5) return 'Second Class Lower';
      if (gpa >= 1.5) return 'Third Class';
      return 'Fail';
    }

    // 4.0 scale
    if (gpa >= 3.7) return 'First Class';
    if (gpa >= 3.0) return 'Second Class Upper';
    if (gpa >= 2.0) return 'Second Class Lower';
    if (gpa >= 1.0) return 'Third Class';
    return 'Fail';
  }

  applyGradeScale(
    percentage: number,
    scale: GradeScale[],
  ): { grade: string; grade_points: number; remark: string } {
    if (!scale || scale.length === 0) {
      return { grade: 'F', grade_points: 0, remark: 'Fail' };
    }

    // Sort by min descending — find the highest band the score qualifies for
    const sorted = [...scale].sort((a, b) => b.min_score - a.min_score);

    for (const band of sorted) {
      if (percentage >= band.min_score && percentage <= band.max_score) {
        return {
          grade: band.grade,
          grade_points: band.points,
          remark: band.remark,
        };
      }
    }

    // Fallback to lowest grade
    const lowest = sorted[sorted.length - 1];
    return {
      grade: lowest?.grade ?? 'F',
      grade_points: lowest?.points ?? 0,
      remark: lowest?.remark ?? 'Fail',
    };
  }
}
