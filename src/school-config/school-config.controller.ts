import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SchoolConfigService } from './school-config.service';
import { ClsService } from 'nestjs-cls';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/generated/prisma/enums';
import { UpdateSchoolConfigDto } from './dto/school-config.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@ApiTags('School Configuration')
@ApiBearerAuth()
@Controller('school-config')
export class SchoolConfigController {
  constructor(
    private readonly service: SchoolConfigService,
    private readonly cls: ClsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get the current school configuration' })
  getConfig() {
    const tenantId = this.cls.get<string>('tenantId');
    return this.service.getConfig(tenantId);
  }

  @Patch()
  @Roles(UserRole.SCHOOL_OWNER, UserRole.PRINCIPAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update school configuration — Owner and Principal only',
  })
  updateConfig(
    @Body() dto: UpdateSchoolConfigDto,
    @CurrentUser() user: { id: string },
  ) {
    const tenantId = this.cls.get<string>('tenantId');
    return this.service.updateConfig(tenantId, dto, user.id);
  }

  // @Get('grading-preview')
  // @ApiOperation({
  //   summary:
  //     'Preview what grade a score would receive under the current grading scale',
  //   description: 'Pass ?score=75 to see what grade 75% maps to',
  // })
  // async gradingPreview(@Body('score') score: number) {
  //   const tenantId = this.cls.get<string>('tenantId');
  //   const config = await this.service.getConfig(tenantId);
  //   const result = this.service.applyGradeScale(
  //     score,
  //     config.grading_scale as any,
  //   );
  //   return { score, ...result };
  // }
}
