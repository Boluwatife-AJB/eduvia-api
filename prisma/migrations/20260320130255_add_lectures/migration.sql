/*
  Warnings:

  - You are about to drop the column `duration` on the `lectures` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "lectures" DROP COLUMN "duration",
ADD COLUMN     "duration_mins" INTEGER;
