/*
  Warnings:

  - You are about to drop the column `end_date` on the `assessments` table. All the data in the column will be lost.
  - You are about to drop the column `start_date` on the `assessments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "assessments" DROP COLUMN "end_date",
DROP COLUMN "start_date",
ADD COLUMN     "end_time" TIMESTAMP(3),
ADD COLUMN     "start_time" TIMESTAMP(3);
