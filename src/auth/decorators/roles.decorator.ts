import { SetMetadata } from '@nestjs/common';
import { UserRole } from 'src/generated/prisma/enums';

// Marks a route as requiring specific roles
// Usage: @Roles(UserRole.PRINCIPAL, UserRole.SCHOOL_OWNER)
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
