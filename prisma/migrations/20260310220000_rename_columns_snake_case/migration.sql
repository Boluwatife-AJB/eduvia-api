-- Rename columns to snake_case to match schema @map() without adding new columns (preserves data).

-- tenants: camelCase -> snake_case
ALTER TABLE "tenants" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "tenants" RENAME COLUMN "deletedAt" TO "deleted_at";
ALTER TABLE "tenants" RENAME COLUMN "updatedAt" TO "updated_at";

-- users: remaining camelCase -> snake_case (created_at, last_login_at, tenant_id, updated_at already exist from earlier migration)
ALTER TABLE "users" RENAME COLUMN "firstName" TO "first_name";
ALTER TABLE "users" RENAME COLUMN "lastName" TO "last_name";
ALTER TABLE "users" RENAME COLUMN "mfaEnabled" TO "mfa_enabled";
ALTER TABLE "users" RENAME COLUMN "mfaSecret" TO "mfa_secret";
ALTER TABLE "users" RENAME COLUMN "passwordHash" TO "password_hash";

-- refresh_tokens: camelCase -> snake_case
ALTER TABLE "refresh_tokens" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "refresh_tokens" RENAME COLUMN "expiresAt" TO "expires_at";
ALTER TABLE "refresh_tokens" RENAME COLUMN "userId" TO "user_id";
