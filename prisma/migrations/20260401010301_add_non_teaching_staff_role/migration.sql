-- CreateEnum
CREATE TYPE "StaffType" AS ENUM ('TEACHING_STAFF', 'NON_TEACHING_STAFF');

-- CreateEnum
CREATE TYPE "NonTeachingStaffRole" AS ENUM ('BURSAR', 'COUNSELOR', 'LAB_ATTENDANT', 'NURSE', 'LIBRARIAN', 'JANITOR', 'CLEANER', 'GARDENER', 'MAINTENANCE_STAFF', 'CLERK', 'RECEPTIONIST', 'SECRETARY', 'ADMINISTRATIVE_ASSISTANT', 'ADMINISTRATIVE_STAFF', 'SECURITY_OFFICER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'JANITOR';
ALTER TYPE "UserRole" ADD VALUE 'CLEANER';
ALTER TYPE "UserRole" ADD VALUE 'GARDENER';
ALTER TYPE "UserRole" ADD VALUE 'MAINTENANCE_STAFF';
ALTER TYPE "UserRole" ADD VALUE 'CLERK';
ALTER TYPE "UserRole" ADD VALUE 'RECEPTIONIST';
ALTER TYPE "UserRole" ADD VALUE 'SECRETARY';
ALTER TYPE "UserRole" ADD VALUE 'ADMINISTRATIVE_ASSISTANT';
ALTER TYPE "UserRole" ADD VALUE 'ADMINISTRATIVE_STAFF';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "enforce_password_change" BOOLEAN NOT NULL DEFAULT true;
