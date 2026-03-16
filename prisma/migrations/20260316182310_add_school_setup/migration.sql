/*
  Warnings:

  - A unique constraint covering the columns `[tenant_id,code]` on the table `subjects` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "subjects_tenant_id_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "subjects_tenant_id_code_key" ON "subjects"("tenant_id", "code");
