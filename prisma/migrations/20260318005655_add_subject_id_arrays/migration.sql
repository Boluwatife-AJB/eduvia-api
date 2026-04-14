-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "subject_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN     "registered_subject_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "teacher_profiles" ADD COLUMN     "assigned_subject_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
