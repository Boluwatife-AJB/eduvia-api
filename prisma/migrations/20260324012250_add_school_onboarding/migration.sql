/*
  school_registrations.plan was TEXT NOT NULL DEFAULT 'free' (see 20260324011502).
  TenantPlan enum was created separately as FREE/BASIC/PRO/ENTERPRISE (20260324012105).
  We must DROP DEFAULT before changing type, map legacy text values, then set a new default.
*/
-- Drop default so PostgreSQL does not try to cast 'free'::text to the new enum automatically
ALTER TABLE "school_registrations" ALTER COLUMN "plan" DROP DEFAULT;

-- New enum values for Prisma schema (BASIC, STANDARD, PREMIUM)
CREATE TYPE "TenantPlan_new" AS ENUM ('BASIC', 'STANDARD', 'PREMIUM');

-- TEXT -> new enum (map old strings and legacy labels)
ALTER TABLE "school_registrations"
ALTER COLUMN "plan" TYPE "TenantPlan_new"
USING (
  CASE LOWER(TRIM("plan"))
    WHEN 'free' THEN 'BASIC'::"TenantPlan_new"
    WHEN 'basic' THEN 'BASIC'::"TenantPlan_new"
    WHEN 'standard' THEN 'STANDARD'::"TenantPlan_new"
    WHEN 'premium' THEN 'PREMIUM'::"TenantPlan_new"
    WHEN 'pro' THEN 'STANDARD'::"TenantPlan_new"
    WHEN 'enterprise' THEN 'PREMIUM'::"TenantPlan_new"
    ELSE 'BASIC'::"TenantPlan_new"
  END
);

-- Old TenantPlan enum had no columns referencing it; swap enum names
ALTER TYPE "TenantPlan" RENAME TO "TenantPlan_old";
ALTER TYPE "TenantPlan_new" RENAME TO "TenantPlan";
DROP TYPE "TenantPlan_old";

ALTER TABLE "school_registrations"
ALTER COLUMN "plan" SET DEFAULT 'BASIC'::"TenantPlan";
