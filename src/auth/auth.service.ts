import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { ClsService } from 'nestjs-cls';
import {
  AccountInactiveException,
  AccountPendingException,
  AccountSuspendedException,
  InvalidCredentialsException,
} from 'src/errors/exceptions/business.exception';
import {
  RefreshTokenExpiredException,
  RefreshTokenInvalidException,
} from 'src/errors/exceptions/token.exception';
import { PrismaService } from '../database/prisma.service';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly cls: ClsService,
  ) {}

  // LOGIN
  async login(identifier: string, password: string) {
    const tenantId = this.cls.get<string>('tenantId');
    if (!tenantId) {
      this.logger.warn(
        'Login attempted without tenant context (missing x-tenant-slug or subdomain)',
      );
      throw new UnauthorizedException('Tenant context is required');
    }

    const user = await this.prisma.user.findFirst({
      where: { identifier, tenant_id: tenantId },
      select: {
        id: true,
        tenant_id: true,
        role: true,
        identifier: true,
        first_name: true,
        last_name: true,
        email: true,
        avatar: true,
        password_hash: true,
        status: true,
      },
    });

    // console.log('user', user);

    if (!user) {
      throw new InvalidCredentialsException();
    }

    if (user.status === 'SUSPENDED') {
      throw new AccountSuspendedException();
    }

    if (user.status === 'PENDING') {
      throw new AccountPendingException();
    }

    // TODO: Handle inactive accounts errors
    if (user.status === 'INACTIVE') {
      throw new UnauthorizedException(
        'Your account is inactive, please contact the school administrator',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      this.logger.warn(
        `Failed login attempt for user ${user.id} from ${tenantId}`,
      );
      throw new InvalidCredentialsException();
    }

    // Record login time
    await this.prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    // Generate JWT token
    const tokens = await this.generateTokens({
      sub: user.id,
      tenantId: user.tenant_id,
      role: user.role,
    });

    this.logger.log(`User ${user.id} logged in from ${tenantId}`);

    return {
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          role: user.role,
          first_name: user.first_name,
          last_name: user.last_name,
          identifier: user.identifier,
        },
        ...tokens,
      },
    };
  }

  // REFRESH TOKENS
  async refreshTokens(refresh_token: string) {
    // this.logger.log(`Refreshing tokens for refresh token: ${refresh_token}`);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refresh_token },
      include: { user: true },
    });
    // console.log('storedToken', storedToken);

    if (!storedToken) {
      this.logger.warn(`Invalid refresh toke: ${refresh_token}`);
      throw new RefreshTokenInvalidException();
    }

    if (storedToken.expires_at < new Date()) {
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });
      this.logger.warn(`Refresh token expired: ${refresh_token}`);
      throw new RefreshTokenExpiredException();
    }

    if (storedToken.user.status !== 'ACTIVE') {
      this.logger.warn(`User ${storedToken.user.id} is not active`);
      throw new AccountInactiveException();
    }

    // Rotation: delete the old token so it can never be used again
    // This means a stolen refresh token can only be used once
    // If an attacker uses it, the real user's next refresh will fail
    await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });

    // Issue a fresh pair of tokens
    return this.generateTokens({
      sub: storedToken.user.id,
      tenantId: storedToken.user.tenant_id,
      role: storedToken.user.role,
    });
  }

  // LOGOUT
  async logout(refreshToken: string, userId: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken, user_id: userId },
    });
    this.logger.log(`User ${userId} logged out`);
    return { message: 'Logged out successfully' };
  }

  // LOGOUT ALL DEVICES
  async logoutAllDevices(userId: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { user_id: userId },
    });
    this.logger.log(`User ${userId} logged out all devices`);
    return { message: 'All devices logged out successfully' };
  }

  // GET CURRENT USER
  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        first_name: true,
        last_name: true,
        identifier: true,
        email: true,
        phone: true,
        avatar: true,
        mfa_enabled: true,
        status: true,
        created_at: true,
        updated_at: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
          },
        },
      },
    });

    return user;
  }

  // HELPERS
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  private async generateTokens(payload: JwtPayload) {
    const [access_token, refresh_token] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN'),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN'),
      }),
    ]);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    console.log(payload.sub, refresh_token, expiresAt);

    await this.prisma.refreshToken.create({
      data: {
        user_id: payload.sub,
        token: refresh_token,
        expires_at: expiresAt,
      },
    });

    // console.log('saved refresh token:', savedToken);

    return { access_token, refresh_token };
  }
}
