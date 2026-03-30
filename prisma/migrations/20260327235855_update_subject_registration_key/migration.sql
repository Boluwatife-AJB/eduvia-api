/*
  Warnings:

  - You are about to drop the column `ca1Score` on the `subject_registrations` table. All the data in the column will be lost.
  - You are about to drop the column `ca2Score` on the `subject_registrations` table. All the data in the column will be lost.
  - You are about to drop the column `ca3Score` on the `subject_registrations` table. All the data in the column will be lost.
  - You are about to drop the column `ca4Score` on the `subject_registrations` table. All the data in the column will be lost.
  - You are about to drop the column `ca5Score` on the `subject_registrations` table. All the data in the column will be lost.
  - You are about to drop the column `caTotalScore` on the `subject_registrations` table. All the data in the column will be lost.
  - You are about to drop the column `examScore` on the `subject_registrations` table. All the data in the column will be lost.
  - You are about to drop the column `totalScore` on the `subject_registrations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "subject_registrations" DROP COLUMN "ca1Score",
DROP COLUMN "ca2Score",
DROP COLUMN "ca3Score",
DROP COLUMN "ca4Score",
DROP COLUMN "ca5Score",
DROP COLUMN "caTotalScore",
DROP COLUMN "examScore",
DROP COLUMN "totalScore",
ADD COLUMN     "ca1_score" DOUBLE PRECISION,
ADD COLUMN     "ca2_score" DOUBLE PRECISION,
ADD COLUMN     "ca3_score" DOUBLE PRECISION,
ADD COLUMN     "ca4_score" DOUBLE PRECISION,
ADD COLUMN     "ca5_score" DOUBLE PRECISION,
ADD COLUMN     "ca_total_score" DOUBLE PRECISION,
ADD COLUMN     "exam_score" DOUBLE PRECISION,
ADD COLUMN     "total_score" DOUBLE PRECISION;
