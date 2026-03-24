-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('PENDING_VERIFICATION', 'PENDING_PAYMENT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "school_registrations" (
    "id" TEXT NOT NULL,
    "school_name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "owner_first_name" TEXT NOT NULL,
    "owner_last_name" TEXT NOT NULL,
    "owner_email" TEXT NOT NULL,
    "owner_phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "student_count" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" "OnboardingStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "email_verification_token" TEXT,
    "email_verified_at" TIMESTAMP(3),
    "payment_ref" TEXT,
    "paid_at" TIMESTAMP(3),
    "tenant_id" TEXT,
    "rejected_reason" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "school_registrations_slug_key" ON "school_registrations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "school_registrations_school_name_slug_key" ON "school_registrations"("school_name", "slug");
