import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from 'src/database/prisma.service';
import { BYPASS_TENANT_KEY } from './decorators/bypass-tenant.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly cls: ClsService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const bypassTenant = this.reflector.getAllAndOverride<boolean>(
      BYPASS_TENANT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (bypassTenant) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const tenantSlug = this.extractTenantSlug(req);

    if (!tenantSlug?.trim()) {
      throw new BadRequestException('Could not identify school from request');
    }

    const slug = tenantSlug.trim();
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, slug: true, status: true },
    });

    if (!tenant) {
      throw new NotFoundException(`School with slug ${slug} not found`);
    }

    if (tenant.status === 'SUSPENDED') {
      throw new ForbiddenException('This school is currently suspended');
    }

    if (tenant.status === 'DELETED') {
      throw new ForbiddenException('This school has been deleted');
    }

    this.cls.set('tenantId', tenant.id);
    this.cls.set('tenant', tenant);
    return true;
  }

  private extractTenantSlug(req: Request): string | undefined {
    const host = req.hostname;
    const parts = host.split('.');
    const subdomain = parts[0];

    return subdomain === 'localhost' || subdomain === 'api'
      ? (req.headers['x-tenant-slug'] as string | undefined)
      : subdomain;
  }
}
