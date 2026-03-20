import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LecturesService } from './lectures.service';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/generated/prisma/enums';
import { RequestUploadUrlDto } from './dto/lecture.dto.ts';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@ApiTags('Lectures')
@ApiBearerAuth()
@Controller('lectures')
export class LecturesController {
  constructor(private readonly lecturesService: LecturesService) {}

  // TEACHER ENDPOINTS
  @Post('upload-url')
  @Roles(
    UserRole.TEACHER,
    UserRole.ASST_TEACHER,
    UserRole.HEAD_TEACHER,
    UserRole.VICE_PRINCIPAL,
    UserRole.ASST_HEAD_TEACHER,
  )
  @ApiOperation({
    summary: 'Step 1: Request a presigned URL to upload a lecture file',
    description:
      'Request a presigned URL to upload a lecture file. This URL is valid for 15 minutes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Upload URL requested successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request: Invalid request body',
  })
  requestUploadUrl(
    @Body() dto: RequestUploadUrlDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.lecturesService.requestUploadUrl(user.id, dto);
  }
}
