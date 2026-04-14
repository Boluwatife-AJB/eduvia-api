import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { Public } from 'src/auth/decorators/public.decorator';
import {
  CheckSlugDto,
  RegisterSchoolDto,
  ReviewRegistrationDto,
} from './dto/onboarding.dto';
import { UserRole } from 'src/generated/prisma/enums';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { BypassTenant } from 'src/tenant/decorators/bypass-tenant.decorator';

@BypassTenant()
@ApiTags('Onboarding')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly service: OnboardingService) {}

  // Public endpoints no auth required
  @Public()
  @Post('check-slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if a school slug is available' })
  checkSlug(@Body() dto: CheckSlugDto) {
    return this.service.checkSlugAvailability(dto.slug);
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new school — Step 1 of 4' })
  register(@Body() dto: RegisterSchoolDto) {
    return this.service.register(dto);
  }

  @Public()
  @Get('verify-email')
  @ApiOperation({
    summary: 'Verify email from registration link — Step 2 of 4',
  })
  verifyEmail(@Query('token') token: string) {
    return this.service.verifyEmail(token);
  }

  @Public()
  @Post('confirm-payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm Paystack payment — Step 3 of 4' })
  confirmPayment(@Body() body: { registrationId: string; paymentRef: string }) {
    return this.service.confirmPayment(body.registrationId, body.paymentRef);
  }

  // SUPER ADMIN ENDPOINTS
  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @Get('registrations')
  @ApiOperation({ summary: 'List all school registrations — Super Admin only' })
  listRegistrations(@Query('status') status?: string) {
    return this.service.listRegistrations(status);
  }

  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @Post('registrations/:id/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Approve or reject a registration — Step 4 of 4 — Super Admin only',
  })
  reviewRegistration(
    @Param('id') id: string,
    @Body() dto: ReviewRegistrationDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.reviewRegistration(id, dto, user.id);
  }
}
