import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { AccessTokenExpiredException } from 'src/errors/exceptions/token.exception';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    // Otherwise, run the normal JWT validation
    return super.canActivate(context);
  }

  // Override the handleRequest method to return the user
  override handleRequest(err: any, user: any): any {
    if (err || !user) {
      if (err && err instanceof UnauthorizedException) {
        throw err;
      }

      throw new AccessTokenExpiredException();
    }
    return user;
  }
}
