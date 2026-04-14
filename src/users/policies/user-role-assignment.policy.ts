import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client';

/**
 * School-tier roles for most user-management routes (lists, stats, suspend, etc.).
 * Does not include SUPER_ADMIN so platform super-admins are not implicitly granted every admin route.
 */
export const ADMIN_ROLES: readonly UserRole[] = [
  UserRole.SCHOOL_OWNER,
  UserRole.PRINCIPAL,
  UserRole.HEAD_TEACHER,
  UserRole.VICE_PRINCIPAL,
  UserRole.ASST_HEAD_TEACHER,
] as const;

/** Roles allowed to call user creation APIs (includes SUPER_ADMIN for bootstrap / break-glass). */
export const USER_CREATE_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  ...ADMIN_ROLES,
] as const;

const SCHOOL_ADMIN_SET = new Set<UserRole>(ADMIN_ROLES);

const PRINCIPAL_TIER_CREATORS = new Set<UserRole>([
  UserRole.PRINCIPAL,
  UserRole.HEAD_TEACHER,
  UserRole.VICE_PRINCIPAL,
  UserRole.ASST_HEAD_TEACHER,
]);

export function isTenantAdminRole(role: UserRole): boolean {
  return role === UserRole.SUPER_ADMIN || SCHOOL_ADMIN_SET.has(role);
}

/**
 * School governance roles: only SUPER_ADMIN or SCHOOL_OWNER may assign these.
 * Prevents principal-tier admins from creating peers or elevating to owner.
 */
const SCHOOL_GOVERNANCE_ROLES = new Set<UserRole>([
  UserRole.SCHOOL_OWNER,
  UserRole.PRINCIPAL,
  UserRole.HEAD_TEACHER,
  UserRole.VICE_PRINCIPAL,
  UserRole.ASST_HEAD_TEACHER,
]);

export function canAssignUserRole(
  creatorRole: UserRole,
  targetRole: UserRole,
): boolean {
  if (creatorRole === UserRole.SUPER_ADMIN) {
    return true;
  }

  if (targetRole === UserRole.SUPER_ADMIN) {
    return false;
  }

  if (creatorRole === UserRole.SCHOOL_OWNER) {
    return true;
  }

  if (SCHOOL_GOVERNANCE_ROLES.has(targetRole)) {
    return false;
  }

  if (PRINCIPAL_TIER_CREATORS.has(creatorRole)) {
    return true;
  }

  return false;
}

export function assertCanAssignUserRole(
  creatorRole: UserRole,
  targetRole: UserRole,
): void {
  if (!canAssignUserRole(creatorRole, targetRole)) {
    throw new ForbiddenException(
      'You are not allowed to create users with this role.',
    );
  }
}
