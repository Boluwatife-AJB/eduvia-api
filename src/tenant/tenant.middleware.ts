import {
  Injectable,
  NestMiddleware,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../database/prisma.service.js';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    // Super admin routes don't belong to a school
    // They access the platform itself, not as a tenant
    if (req.path.startsWith('/api/v1/super-admin')) {
      return next();
    }

    // Extract the subdomain from the request host
    const host = req.hostname;
    const parts = host.split('.');
    const subdomain = parts[0];

    // If the subdomain is localhost or api, use the tenant slug from the request header
    // Otherwise, use the subdomain as the tenant slug
    const tenantSlug =
      subdomain === 'localhost' || subdomain === 'api'
        ? (req.headers['x-tenant-slug'] as string)
        : subdomain;

    if (!tenantSlug) {
      throw new NotFoundException('Could not identify school from request');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, slug: true, status: true },
    });

    if (!tenant) {
      throw new NotFoundException(`School with slug ${tenantSlug} not found`);
    }

    if (tenant.status === 'SUSPENDED') {
      throw new ForbiddenException('This school is currently suspended');
    }

    if (tenant.status === 'DELETED') {
      throw new ForbiddenException('This school has been deleted');
    }

    // Set the tenant in the context
    this.cls.set('tenantId', tenant.id);
    this.cls.set('tenant', tenant);

    next();
  }
}
