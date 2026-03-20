import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LecturesService } from './lectures.service';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/generated/prisma/enums';
import {
  ConfirmUploadDto,
  CreateLectureDto,
  QueryLecturesDto,
  RequestUploadUrlDto,
  UpdateLectureDto,
  UpdateViewProgressDto,
} from './dto/lecture.dto.ts';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { ACCEPTED_MIME_TYPES } from 'src/storage/storage.service';

const TEACHER_ROLES = [
  UserRole.TEACHER,
  UserRole.ASST_TEACHER,
  UserRole.HEAD_TEACHER,
  UserRole.VICE_PRINCIPAL,
  UserRole.ASST_HEAD_TEACHER,
];
@ApiTags('Lectures')
@ApiBearerAuth()
@Controller('lectures')
export class LecturesController {
  constructor(private readonly lecturesService: LecturesService) {}

  // TEACHER ENDPOINTS
  @Post('upload-url')
  @Roles(...TEACHER_ROLES)
  @ApiOperation({
    summary: 'Step 1: Request a presigned URL to upload a lecture file',
    description: `Request a presigned URL to upload a lecture file. This URL is valid for 15 minutes. Acceptable mime types are: ${Object.keys(ACCEPTED_MIME_TYPES).join(', ')}`,
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

  @Post()
  @Roles(...TEACHER_ROLES)
  @ApiOperation({
    summary: 'Step 2: Create a new lecture and record with metadata',
    description:
      'Create a new lecture and record with metadata. This will return a presigned upload URL if the lecture requires a file upload.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lecture created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request: Invalid request body',
  })
  createLecture(
    @Body() dto: CreateLectureDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.lecturesService.createLecture(user.id, dto);
  }

  @Post(':id/confirm-upload')
  @Roles(...TEACHER_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Step 3 — Confirm file upload complete and link to lecture',
  })
  confirmUpload(
    @Param('id') id: string,
    @Body() dto: ConfirmUploadDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.lecturesService.confirmUpload(user.id, id, dto);
  }

  @Patch(':id/publish')
  @Roles(...TEACHER_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a lecture — makes it visible to students' })
  publish(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.lecturesService.publishLecture(user.id, id);
  }

  @Patch(':id/unpublish')
  @Roles(...TEACHER_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unpublish a lecture — hides it from students' })
  unpublish(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.lecturesService.unpublishLecture(user.id, id);
  }

  @Patch(':id/archive')
  @Roles(...TEACHER_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a lecture — hides it from students' })
  archive(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.lecturesService.archiveLecture(user.id, id);
  }

  @Get('my-lectures')
  @Roles(...TEACHER_ROLES)
  @ApiOperation({
    summary: 'Teacher views all their lectures including drafts',
  })
  getMyLectures(
    @CurrentUser() user: { id: string },
    @Query() query: QueryLecturesDto,
  ) {
    return this.lecturesService.getTeacherLectures(user.id, query);
  }

  @Get('my-lectures/:id')
  @Roles(...TEACHER_ROLES)
  @ApiOperation({ summary: 'Teacher views a specific lecture with view stats' })
  getMyLectureById(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.lecturesService.getTeacherLectureById(id, user.id);
  }

  @Put(':id')
  @Roles(...TEACHER_ROLES)
  @ApiOperation({ summary: 'Update lecture metadata' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLectureDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.lecturesService.updateLecture(user.id, id, dto);
  }

  @Delete(':id')
  @Roles(...TEACHER_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a lecture and its file from storage' })
  delete(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.lecturesService.deleteLecture(user.id, id);
  }

  // STUDENT ENDPOINTS
  @Get()
  @Roles(UserRole.STUDENT)
  @ApiOperation({
    summary: 'Student views published lectures for their registered subjects',
  })
  getMyLecturesAsStudent(
    @CurrentUser() user: { id: string },
    @Query() query: QueryLecturesDto,
  ) {
    return this.lecturesService.getStudentLectures(user.id, query);
  }

  @Get(':id')
  @Roles(UserRole.STUDENT)
  @ApiOperation({
    summary: 'Student opens a lecture — records view automatically',
  })
  getLectureAsStudent(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.lecturesService.getStudentLectureById(id, user.id);
  }

  @Patch(':id/progress')
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Student updates their progress through a lecture (0-100%)',
  })
  updateProgress(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateViewProgressDto,
  ) {
    return this.lecturesService.updateViewProgress(user.id, id, dto);
  }
}
