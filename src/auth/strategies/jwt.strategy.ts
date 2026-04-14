import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  AccountInactiveException,
  UserNotFoundException,
} from 'src/errors/exceptions/business.exception';
import { UserRole, UserStatus } from 'src/generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
// import { AuthErrorCode } from '../auth-error-codes';

/** Shape attached to `request.user` after JwtStrategy.validate() */
export interface JwtAuthUser {
  id: string;
  tenant_id: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  identifier: string;
  status: UserStatus;
}

export interface JwtPayload {
  sub: string; // User ID
  tenantId: string; // Tenant ID
  role: string; // User role
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      // Extract the JWT from the Authorization header
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      //Reject expired tokens
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtAuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        tenant_id: true,
        role: true,
        first_name: true,
        last_name: true,
        identifier: true,
        status: true,
      },
    });

    // If the user is not found, throw an error
    if (!user) {
      throw new UserNotFoundException();
    }

    // If the user is not active, throw an error
    if (user.status !== 'ACTIVE') {
      throw new AccountInactiveException();
    }

    // If the user is found, return the user
    return user;
  }
}
