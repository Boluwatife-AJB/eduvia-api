-- CreateEnum
CREATE TYPE "SchoolType" AS ENUM ('PRIVATE', 'PUBLIC', 'MIXED');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('TEST', 'EXAM', 'ASSIGNMENT', 'POP_QUIZ', 'CLASSWORK', 'PROJECT', 'PRESENTATION');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PUBLISHED', 'ONGOING', 'ENDED', 'GRADED', 'UNPUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_IN_THE_BLANK', 'ESSAY', 'SHORT_ANSWER');

-- CreateEnum
CREATE TYPE "CAComponent" AS ENUM ('NONE', 'CA1', 'CA2', 'CA3', 'CA4', 'CA5');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'WAIVED');

-- CreateEnum
CREATE TYPE "PaymentCategory" AS ENUM ('TUITION', 'MATERIALS', 'FIELD_TRIP', 'EXAM_FEE', 'LIBRARY_FEE', 'SPORTS_FEE', 'OTHER');

-- CreateEnum
CREATE TYPE "SalaryStatus" AS ENUM ('SCHEDULED', 'PROCESSING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('SUBMITTED_FOR_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED', 'RECALLED', 'REPUBLISHED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "subject_registrations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "credit_units" INTEGER NOT NULL DEFAULT 3,
    "ca1Score" DOUBLE PRECISION,
    "ca2Score" DOUBLE PRECISION,
    "ca3Score" DOUBLE PRECISION,
    "ca4Score" DOUBLE PRECISION,
    "ca5Score" DOUBLE PRECISION,
    "caTotalScore" DOUBLE PRECISION,
    "examScore" DOUBLE PRECISION,
    "totalScore" DOUBLE PRECISION,
    "grade" TEXT,
    "grade_points" DOUBLE PRECISION,
    "remark" TEXT,
    "is_passed" BOOLEAN,
    "is_approval" BOOLEAN NOT NULL DEFAULT false,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "term_results" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "total_score" DOUBLE PRECISION,
    "average" DOUBLE PRECISION,
    "total_credit_units" INTEGER,
    "term_gpa" DOUBLE PRECISION,
    "position" INTEGER,
    "out_of" INTEGER,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "pdf_key" TEXT,
    "pdf_url" TEXT,
    "pdf_generated_at" TIMESTAMP(3),
    "principal_comment" TEXT,
    "teacher_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "term_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cumulative_results" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "session_cgpa" DOUBLE PRECISION,
    "lifetime_cgpa" DOUBLE PRECISION,
    "total_credit_units_earned" INTEGER,
    "total_credit_units_attempted" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cumulative_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "school_type" "SchoolType" NOT NULL DEFAULT 'PRIVATE',
    "ca_weight" INTEGER NOT NULL DEFAULT 40,
    "exam_weight" INTEGER NOT NULL DEFAULT 60,
    "grading_scale" JSONB NOT NULL,
    "gpa_scale" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "pass_mark" INTEGER NOT NULL DEFAULT 40,
    "require_result_approval" BOOLEAN NOT NULL DEFAULT true,
    "require_exam_approval" BOOLEAN NOT NULL DEFAULT true,
    "email_sender_name" TEXT,
    "currency_code" TEXT NOT NULL DEFAULT 'NGN',
    "currency_symbol" TEXT DEFAULT '₦',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "type" "AssessmentType" NOT NULL,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "class_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "teacher_id" TEXT[],
    "term_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "duration_mins" INTEGER,
    "total_marks" DOUBLE PRECISION NOT NULL,
    "pass_mark" DOUBLE PRECISION,
    "is_exam_component" BOOLEAN NOT NULL DEFAULT false,
    "ca_component" "CAComponent" NOT NULL DEFAULT 'NONE',
    "max_attempts" INTEGER DEFAULT 1,
    "shuffle_questions" BOOLEAN NOT NULL DEFAULT false,
    "shuffle_options" BOOLEAN NOT NULL DEFAULT false,
    "prevent_tab_switch" BOOLEAN NOT NULL DEFAULT false,
    "prevent_screenshot" BOOLEAN NOT NULL DEFAULT false,
    "require_camera" BOOLEAN NOT NULL DEFAULT false,
    "submitted_for_approval" TIMESTAMP(3),
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_by" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "result_generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_questions" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "question_text" TEXT NOT NULL,
    "question_image" TEXT,
    "marks" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL,
    "options" JSONB,
    "correct_answer" TEXT,
    "accepted_answers" JSONB,
    "marking_guide" TEXT,
    "max_word_count" INTEGER,
    "is_auto_gradable" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_submissions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "time_spent_mins" INTEGER,
    "is_submitted" BOOLEAN NOT NULL DEFAULT false,
    "is_late" BOOLEAN NOT NULL DEFAULT false,
    "auto_scores" DOUBLE PRECISION,
    "manual_scores" DOUBLE PRECISION,
    "total_scores" DOUBLE PRECISION,
    "percentage_score" DOUBLE PRECISION,
    "grade" TEXT,
    "grade_points" DOUBLE PRECISION,
    "is_passed" BOOLEAN,
    "graded_by" TEXT,
    "graded_at" TIMESTAMP(3),
    "feedback" TEXT,
    "tab_switch_count" INTEGER NOT NULL DEFAULT 0,
    "screenshot_count" INTEGER NOT NULL DEFAULT 0,
    "camera_count" INTEGER NOT NULL DEFAULT 0,
    "flagged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_answers" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "selected_option_id" TEXT,
    "text_answer" TEXT,
    "marks_awarded" DOUBLE PRECISION,
    "is_correct" BOOLEAN,
    "teacher_comment" TEXT,
    "graded_by" TEXT,
    "graded_at" TIMESTAMP(3),

    CONSTRAINT "submission_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "paystack_secret_key" TEXT,
    "flutterwave_secret_key" TEXT,
    "active_gateway" TEXT NOT NULL DEFAULT 'paystack',
    "enable_late_fee" BOOLEAN NOT NULL DEFAULT false,
    "late_fee_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "late_fee_grace_days" INTEGER NOT NULL DEFAULT 7,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_payments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "fee_item_id" TEXT NOT NULL,
    "category" "PaymentCategory" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "amount_paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "reference" TEXT NOT NULL,
    "gateway_ref" TEXT,
    "gateway" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "is_late_pay" BOOLEAN NOT NULL DEFAULT false,
    "late_fee_applied" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "receipt_number" TEXT,
    "receipt_pdf_key" TEXT,
    "receipt_pdf_url" TEXT,
    "is_waived" BOOLEAN NOT NULL DEFAULT false,
    "waived_by" TEXT,
    "waived_reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "PaymentCategory" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "class_id" TEXT,
    "term_id" TEXT,
    "session_id" TEXT,
    "due_date" TIMESTAMP(3),
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_salaries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "basic_salary" DOUBLE PRECISION NOT NULL,
    "allowances" JSONB NOT NULL,
    "gross_salary" DOUBLE PRECISION NOT NULL,
    "deductions" JSONB NOT NULL,
    "total_deductions" DOUBLE PRECISION NOT NULL,
    "net_salary" DOUBLE PRECISION NOT NULL,
    "loan_deduction_ids" TEXT[],
    "status" "SalaryStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),
    "payslip_pdf_key" TEXT,
    "payslip_pdf_url" TEXT,
    "reference" TEXT NOT NULL,
    "gateway" TEXT,
    "gateway_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_salaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_bonuses" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "salary_id" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "paid_at" TIMESTAMP(3),
    "status" "SalaryStatus" NOT NULL DEFAULT 'SCHEDULED',

    CONSTRAINT "staff_bonuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "action" "ApprovalAction" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "comment" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "to" TEXT[],
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "error_log" JSONB,
    "message_id" TEXT,
    "job_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subject_registrations_student_id_subject_id_term_id_session_key" ON "subject_registrations"("student_id", "subject_id", "term_id", "session_id");

-- CreateIndex
CREATE UNIQUE INDEX "term_results_student_id_term_id_key" ON "term_results"("student_id", "term_id");

-- CreateIndex
CREATE UNIQUE INDEX "cumulative_results_student_id_session_id_key" ON "cumulative_results"("student_id", "session_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_submissions_assessment_id_student_id_attempt_num_key" ON "assessment_submissions"("assessment_id", "student_id", "attempt_number");

-- CreateIndex
CREATE UNIQUE INDEX "submission_answers_submission_id_question_id_key" ON "submission_answers"("submission_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_configs_tenant_id_key" ON "payment_configs"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_payments_reference_key" ON "student_payments"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "student_payments_receipt_number_key" ON "student_payments"("receipt_number");

-- CreateIndex
CREATE UNIQUE INDEX "staff_salaries_reference_key" ON "staff_salaries"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "staff_salaries_staff_id_month_key" ON "staff_salaries"("staff_id", "month");

-- AddForeignKey
ALTER TABLE "school_configs" ADD CONSTRAINT "school_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_submissions" ADD CONSTRAINT "assessment_submissions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_answers" ADD CONSTRAINT "submission_answers_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "assessment_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_answers" ADD CONSTRAINT "submission_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "assessment_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_configs" ADD CONSTRAINT "payment_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_bonuses" ADD CONSTRAINT "staff_bonuses_salary_id_fkey" FOREIGN KEY ("salary_id") REFERENCES "staff_salaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_logs" ADD CONSTRAINT "approval_logs_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
