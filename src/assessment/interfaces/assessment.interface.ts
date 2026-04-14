export interface GradeScale {
  grade: string;
  min_score: number;
  max_score: number;
  points: number;
  remark: string;
}

export interface GradingResult {
  grade: string;
  grade_points: number;
  remark: string;
}
