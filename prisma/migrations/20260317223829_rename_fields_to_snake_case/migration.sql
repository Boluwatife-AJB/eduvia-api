/*
  Warnings:

  - You are about to drop the column `subjectType` on the `class_subjects` table. All the data in the column will be lost.
  - You are about to drop the column `mfaEnabled` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "class_subjects" DROP COLUMN "subjectType",
ADD COLUMN     "subject_type" "SubjectType" NOT NULL DEFAULT 'COMPULSORY';

-- AlterTable
ALTER TABLE "users" DROP COLUMN "mfaEnabled",
ADD COLUMN     "mfa_enabled" BOOLEAN NOT NULL DEFAULT false;
