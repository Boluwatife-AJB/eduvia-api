-- CreateEnum
CREATE TYPE "RepositoryScope" AS ENUM ('CLASS_DOCUMENTS', 'SUBJECT_DOCUMENTS', 'PAST_QUESTIONS', 'DEPARTMENT_DOCUMENTS', 'SCHOOL_DOCUMENTS', 'STAFF_RECORDS', 'TUITION_PAYMENTS', 'STAFF_SALARY', 'SCHOOL_EXPENSES', 'HEALTH_RECORDS', 'COUNSELING_RECORDS', 'DISCIPLINARY_RECORDS', 'LIBRARY_RECORDS', 'LABORATORY_RECORDS', 'INVENTORY_RECORDS', 'MAINTENANCE_RECORDS', 'VISITOR_LOGS', 'PTA_MEETINGS', 'STAFF_MEETINGS', 'SCHOOL_EVENTS', 'EXTRACURRICULAR', 'SPORT_RECORDS', 'OTHER');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "TenantStoragePlan" AS ENUM ('FREE', 'BASIC', 'PRO', 'ENTERPRISE');

-- CreateTable
CREATE TABLE "repository_folders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "RepositoryScope" NOT NULL,
    "scope_id" TEXT,
    "parent_folder_id" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "status" "FileStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repository_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_files" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "folder_id" TEXT NOT NULL,
    "scope_id" TEXT,
    "scope" "RepositoryScope" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "current_version_id" TEXT,
    "total_versions" INTEGER NOT NULL DEFAULT 0,
    "status" "FileStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_global_search" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "retention_until" TIMESTAMP(3),
    "uploaded_by" TEXT NOT NULL,
    "link_record_type" TEXT,
    "link_record_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repository_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_file_versions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "file_key" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "change_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repository_file_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_share_links" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "access_count" INTEGER NOT NULL DEFAULT 0,
    "max_access_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repository_share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_file_access_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "user_id" TEXT,
    "share_token" TEXT,
    "action" TEXT NOT NULL,
    "accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT NOT NULL,

    CONSTRAINT "repository_file_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_storage" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "used_bytes" BIGINT NOT NULL DEFAULT 0,
    "quota_bytes" BIGINT NOT NULL,
    "plan" "TenantStoragePlan" NOT NULL DEFAULT 'FREE',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_storage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "repository_folders_tenant_id_name_parent_folder_id_scope_id_key" ON "repository_folders"("tenant_id", "name", "parent_folder_id", "scope_id", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "repository_file_versions_file_id_version_number_key" ON "repository_file_versions"("file_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "repository_share_links_token_key" ON "repository_share_links"("token");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_storage_tenant_id_key" ON "tenant_storage"("tenant_id");

-- AddForeignKey
ALTER TABLE "repository_folders" ADD CONSTRAINT "repository_folders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_folders" ADD CONSTRAINT "repository_folders_parent_folder_id_fkey" FOREIGN KEY ("parent_folder_id") REFERENCES "repository_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_files" ADD CONSTRAINT "repository_files_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_files" ADD CONSTRAINT "repository_files_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "repository_folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_file_versions" ADD CONSTRAINT "repository_file_versions_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "repository_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_share_links" ADD CONSTRAINT "repository_share_links_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "repository_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_file_access_logs" ADD CONSTRAINT "repository_file_access_logs_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "repository_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_storage" ADD CONSTRAINT "tenant_storage_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
