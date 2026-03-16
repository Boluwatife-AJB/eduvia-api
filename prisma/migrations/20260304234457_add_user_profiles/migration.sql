/*
  Warnings:

  - You are about to drop the column `guardian_id` on the `student_profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "student_profiles" DROP COLUMN "guardian_id",
ADD COLUMN     "guardian_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
