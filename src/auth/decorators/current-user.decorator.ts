import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Extracts the current user from the request
// Usage: login(@CurrentUser() user: User)
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // populated by JwtStrategy.validate()
  },
);
