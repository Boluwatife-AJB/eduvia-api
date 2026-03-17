/*
  Warnings:

  - You are about to drop the column `teacher_id` on the `class_subjects` table. All the data in the column will be lost.
  - You are about to drop the column `subject_ids` on the `teacher_profiles` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tenant_id,code,department_id]` on the table `subjects` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `title` to the `subjects` table without a default value. This is not possible if the table is not empty.
  - Made the column `code` on table `subjects` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('COMPULSORY', 'ELECTIVE', 'OPTIONAL');

-- DropIndex
DROP INDEX "subjects_tenant_id_code_key";

-- AlterTable
ALTER TABLE "class_subjects" DROP COLUMN "teacher_id",
ADD COLUMN     "subjectType" "SubjectType" NOT NULL DEFAULT 'COMPULSORY';

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "title" TEXT NOT NULL,
ALTER COLUMN "code" SET NOT NULL;

-- AlterTable
ALTER TABLE "teacher_profiles" DROP COLUMN "subject_ids";

-- CreateTable
CREATE TABLE "subject_teachers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "class_subject_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,

    CONSTRAINT "subject_teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_subject_registrations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "class_subject_id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "registration_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_subject_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subject_teachers_tenant_id_class_subject_id_teacher_id_key" ON "subject_teachers"("tenant_id", "class_subject_id", "teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_subject_registrations_tenant_id_student_id_class_su_key" ON "student_subject_registrations"("tenant_id", "student_id", "class_subject_id", "term_id");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_tenant_id_code_department_id_key" ON "subjects"("tenant_id", "code", "department_id");

-- AddForeignKey
ALTER TABLE "subject_teachers" ADD CONSTRAINT "subject_teachers_class_subject_id_fkey" FOREIGN KEY ("class_subject_id") REFERENCES "class_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_subject_registrations" ADD CONSTRAINT "student_subject_registrations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_subject_registrations" ADD CONSTRAINT "student_subject_registrations_class_subject_id_fkey" FOREIGN KEY ("class_subject_id") REFERENCES "class_subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_subject_registrations" ADD CONSTRAINT "student_subject_registrations_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "academic_terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
