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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AssessmentService } from './assessment.service';
import {
  CreateAssessmentDto,
  UpdateAssessmentDto,
} from './dto/create-assessment.dto';
import { GradeManualAnswersDto } from './dto/grade-manual.dto';
import { AutoSaveDto, SubmitAnswersDto } from './dto/submit-answer.dto';
import { GradingService } from './grading.service';
import { UserRole } from 'src/generated/prisma/enums';

const TEACHER_ROLES = [UserRole.TEACHER];
const ADMIN_ROLES = [
  UserRole.SCHOOL_OWNER,
  UserRole.PRINCIPAL,
  UserRole.HEAD_TEACHER,
  UserRole.HOD,
];

@ApiTags('Assessments')
@ApiBearerAuth()
@Controller('assessments')
export class AssessmentController {
  constructor(
    private readonly assessmentService: AssessmentService,
    private readonly gradingService: GradingService,
  ) {}

  // TEACHER: CREATE & MANAGE

  @Post()
  @Roles(...TEACHER_ROLES)
  @ApiOperation({ summary: 'Teacher creates a new assessment' })
  create(
    @Body() dto: CreateAssessmentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.assessmentService.createAssessment(dto, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'List assessments — teachers see their own, admins see all',
  })
  @ApiQuery({
    name: 'classId',
    required: false,
    description: 'Optional class filter',
  })
  @ApiQuery({
    name: 'subjectId',
    required: false,
    description: 'Optional subject filter',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Optional assessment status filter',
  })
  findAll(
    @CurrentUser() user: { id: string; role: UserRole },
    @Query('classId') classId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('status') status?: string,
  ) {
    return this.assessmentService.findAll(
      user,
      classId ?? '',
      subjectId ?? '',
      status ?? '',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get assessment detail' })
  findOne(@Param('id') id: string) {
    return this.assessmentService.findOne(id);
  }

  @Put(':id')
  @Roles(...TEACHER_ROLES)
  @ApiOperation({ summary: 'Update an assessment — draft only' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAssessmentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.assessmentService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles(...TEACHER_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an assessment — draft only' })
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.assessmentService.remove(id, user.id);
  }

  // PUBLISH & APPROVAL

  @Patch(':id/publish')
  @Roles(...TEACHER_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Publish assessment — exams go to approval queue, others publish immediately',
  })
  publish(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.assessmentService.publish(id, user.id);
  }

  @Patch(':id/approve')
  @Roles(...ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin approves a pending exam' })
  approve(
    @Param('id') id: string,
    @Body('comment') comment: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.assessmentService.approveAssessment(id, user.id, comment);
  }

  @Patch(':id/reject')
  @Roles(...ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin rejects a pending exam with a reason' })
  reject(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.assessmentService.rejectAssessment(id, user.id, reason);
  }

  @Patch(':id/publish-approved')
  @Roles(...TEACHER_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Teacher publishes an already-approved exam to students',
  })
  publishApproved(
    @Param('id') id: string,
    // @CurrentUser() user: { id: string },
  ) {
    return this.assessmentService.publishApprovedAssessment(id);
  }

  // STUDENT: TAKE ASSESSMENT AND SUBMIT ANSWERS

  @Post(':id/start')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Student starts an assessment — returns questions' })
  startAssessment(
    @Param('id') assessmentId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.assessmentService.startSubmission(assessmentId, user.id);
  }

  @Patch(':id/submissions/:submissionId/auto-save')
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Auto-save progress during a timed exam' })
  autoSave(
    @Param('submissionId') submissionId: string,
    @Body() dto: AutoSaveDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.assessmentService.autoSave(submissionId, user.id, dto.answers);
  }

  @Post(':id/submissions/:submissionId/submit')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Student makes final submission' })
  submit(
    @Param('submissionId') submissionId: string,
    @Body() dto: SubmitAnswersDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.assessmentService.submitAnswers(
      submissionId,
      user.id,
      dto.answers,
    );
  }

  // TEACHER: VIEW SUBMISSIONS & GRADE

  @Get(':id/submissions')
  @Roles(...TEACHER_ROLES, ...ADMIN_ROLES)
  @ApiOperation({ summary: 'Teacher views all submissions for an assessment' })
  getSubmissions(
    @Param('id') assessmentId: string,
    @Query('status') status?: string,
  ) {
    return this.assessmentService.getSubmissions(assessmentId, status);
  }

  @Get(':id/submissions/:submissionId')
  @ApiOperation({ summary: 'Get a specific submission detail' })
  getSubmission(
    @Param('id') assessmentId: string,
    @Param('submissionId') submissionId: string,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.assessmentService.getSubmission(
      assessmentId,
      submissionId,
      user,
    );
  }

  @Patch(':id/submissions/:submissionId/grade')
  @Roles(...TEACHER_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Teacher grades manual questions (essay, short answer)',
  })
  gradeManual(
    @Param('submissionId') submissionId: string,
    @Body() dto: GradeManualAnswersDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.gradingService.gradeManualAnswers(
      submissionId,
      user.id,
      dto.grades,
    );
  }
}
