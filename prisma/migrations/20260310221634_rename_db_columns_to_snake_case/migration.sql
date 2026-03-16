/*
  Warnings:

  - You are about to drop the column `mfa_enabled` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "mfa_enabled",
ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;

-- RenameForeignKey
ALTER TABLE "refresh_tokens" RENAME CONSTRAINT "refresh_tokens_userId_fkey" TO "refresh_tokens_user_id_fkey";
