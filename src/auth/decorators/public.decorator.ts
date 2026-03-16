import { SetMetadata } from '@nestjs/common';

// Marks a route as public, skipping authentication and authorization checks
// Usage: @Public() on any controller or method to skip authentication and authorization checks
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
