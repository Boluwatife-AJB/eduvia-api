/*
  Warnings:

  - The values [NONE] on the enum `CAComponent` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[tenant_id]` on the table `school_configs` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CAComponent_new" AS ENUM ('CA1', 'CA2', 'CA3', 'CA4', 'CA5');
ALTER TABLE "public"."assessments" ALTER COLUMN "ca_component" DROP DEFAULT;
ALTER TABLE "assessments" ALTER COLUMN "ca_component" TYPE "CAComponent_new" USING ("ca_component"::text::"CAComponent_new");
ALTER TYPE "CAComponent" RENAME TO "CAComponent_old";
ALTER TYPE "CAComponent_new" RENAME TO "CAComponent";
DROP TYPE "public"."CAComponent_old";
ALTER TABLE "assessments" ALTER COLUMN "ca_component" SET DEFAULT 'CA1';
COMMIT;

-- AlterTable
ALTER TABLE "assessments" ALTER COLUMN "ca_component" SET DEFAULT 'CA1';

-- CreateIndex
CREATE UNIQUE INDEX "school_configs_tenant_id_key" ON "school_configs"("tenant_id");
