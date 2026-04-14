/*
  Warnings:

  - You are about to drop the column `teacherProfileId` on the `tutorial_classes` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "tutorial_classes" DROP CONSTRAINT "tutorial_classes_teacherProfileId_fkey";

-- AlterTable
ALTER TABLE "tutorial_classes" DROP COLUMN "teacherProfileId",
ADD COLUMN     "teacher_profile_id" TEXT;

-- AddForeignKey
ALTER TABLE "tutorial_classes" ADD CONSTRAINT "tutorial_classes_teacher_profile_id_fkey" FOREIGN KEY ("teacher_profile_id") REFERENCES "teacher_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
