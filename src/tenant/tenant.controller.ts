import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/auth/decorators/public.decorator';
import { TenantService } from './tenant.service';

@ApiTags('Tenant')
@Controller('tenant')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  // Public
  @Public()
  @Get(':slug/public')
  @ApiOperation({
    summary: 'Get public school profile by slug',
    description:
      'Returns non-sensitive school data for the sign-in page personalisation. No authentication required.',
  })
  getPublicProfile(@Param('slug') slug: string) {
    return this.tenantService.getPublicProfile(slug);
  }
}
