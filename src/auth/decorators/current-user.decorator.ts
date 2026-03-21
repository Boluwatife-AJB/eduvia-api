import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtAuthUser } from '../strategies/jwt.strategy';

type AuthenticatedRequest = Request & { user: JwtAuthUser };

// Extracts the current user from the request
// Usage: @CurrentUser() user: JwtAuthUser
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtAuthUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
