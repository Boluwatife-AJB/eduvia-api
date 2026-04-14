import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { TenantNotFoundException } from 'src/errors/exceptions/business.exception';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicProfile(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        status: true,
        // email: true,
        // phone: true,
        // address: true,
      },
    });
    if (!tenant) throw new TenantNotFoundException();

    if (tenant.status === 'SUSPENDED') {
      return {
        ...tenant,
        is_suspended: true,
        message: 'This school account is currently suspended.',
      };
    }
    return {
      ...tenant,
      is_suspended: false,
    };
  }
}
