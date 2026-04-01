-- Add new columns as nullable first so existing rows can be backfilled.
ALTER TABLE "staff_profiles"
ADD COLUMN "class_of_degree" TEXT,
ADD COLUMN "course_of_study" TEXT,
ADD COLUMN "qualification" TEXT,
ADD COLUMN "staff_role" "NonTeachingStaffRole",
ADD COLUMN "year_of_graduation" TEXT;

-- Backfill from existing user role and legacy staff columns.
UPDATE "staff_profiles" sp
SET
  "staff_role" = CASE u."role"::text
    WHEN 'BURSAR' THEN 'BURSAR'::"NonTeachingStaffRole"
    WHEN 'COUNSELOR' THEN 'COUNSELOR'::"NonTeachingStaffRole"
    WHEN 'LAB_ATTENDANT' THEN 'LAB_ATTENDANT'::"NonTeachingStaffRole"
    WHEN 'NURSE' THEN 'NURSE'::"NonTeachingStaffRole"
    WHEN 'LIBRARIAN' THEN 'LIBRARIAN'::"NonTeachingStaffRole"
    WHEN 'JANITOR' THEN 'JANITOR'::"NonTeachingStaffRole"
    WHEN 'CLEANER' THEN 'CLEANER'::"NonTeachingStaffRole"
    WHEN 'GARDENER' THEN 'GARDENER'::"NonTeachingStaffRole"
    WHEN 'MAINTENANCE_STAFF' THEN 'MAINTENANCE_STAFF'::"NonTeachingStaffRole"
    WHEN 'CLERK' THEN 'CLERK'::"NonTeachingStaffRole"
    WHEN 'RECEPTIONIST' THEN 'RECEPTIONIST'::"NonTeachingStaffRole"
    WHEN 'SECRETARY' THEN 'SECRETARY'::"NonTeachingStaffRole"
    WHEN 'ADMINISTRATIVE_ASSISTANT' THEN 'ADMINISTRATIVE_ASSISTANT'::"NonTeachingStaffRole"
    WHEN 'SECURITY_OFFICER' THEN 'SECURITY_OFFICER'::"NonTeachingStaffRole"
    ELSE 'ADMINISTRATIVE_STAFF'::"NonTeachingStaffRole"
  END,
  "qualification" = sp."staff_type",
  "class_of_degree" = sp."staff_type",
  "course_of_study" = sp."department_id",
  "year_of_graduation" = CASE
    WHEN sp."date_joined" IS NOT NULL THEN EXTRACT(YEAR FROM sp."date_joined")::text
    ELSE NULL
  END
FROM "users" u
WHERE u."id" = sp."user_id";

-- Enforce required constraint after backfill.
ALTER TABLE "staff_profiles"
ALTER COLUMN "staff_role" SET NOT NULL;

-- Remove legacy columns after data has been migrated.
ALTER TABLE "staff_profiles"
DROP COLUMN "department_id",
DROP COLUMN "staff_type";
