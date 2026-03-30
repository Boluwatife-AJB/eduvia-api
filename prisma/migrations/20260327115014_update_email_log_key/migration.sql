/*
  Warnings:

  - You are about to drop the column `created_at` on the `email_logs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "email_logs" DROP COLUMN "created_at",
ADD COLUMN     "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
