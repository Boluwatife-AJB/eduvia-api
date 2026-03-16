/*
  Warnings:

  - The `ward_ids` column on the `guardian_profiles` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `subject_id` on the `teacher_profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "guardian_profiles" DROP COLUMN "ward_ids",
ADD COLUMN     "ward_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "teacher_profiles" DROP COLUMN "subject_id",
ADD COLUMN     "subject_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "department_id" DROP NOT NULL;
