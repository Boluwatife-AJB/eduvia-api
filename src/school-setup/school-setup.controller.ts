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
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/generated/prisma/client';
import {
  CreateAcademicSessionDto,
  UpdateAcademicSessionDto,
} from './dto/academic-session.dto';
import {
  AssignSubjectToClassDto,
  AssignTeacherToSubjectDto,
  BulkAssignSubjectsDto,
  BulkAssignTeachersDto,
  RegisterSubjectsDto,
  UpdateSubjectRegistrationDto,
} from './dto/class-subject.dto';
import { CreateClassDto, UpdateClassDto } from './dto/class.dto';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/subject.dto';
import { CreateTermDto, UpdateTermDto } from './dto/term.dto';
import { SchoolSetupService } from './school-setup.service';
import { AssignStudentToClassDto } from './dto/assign-student.dto';

const ADMIN_ROLES = [
  UserRole.SCHOOL_OWNER,
  UserRole.PRINCIPAL,
  UserRole.HEAD_TEACHER,
  UserRole.VICE_PRINCIPAL,
  UserRole.ASST_HEAD_TEACHER,
];

@ApiTags('School Setup')
@ApiBearerAuth()
@Controller('school-setup')
export class SchoolSetupController {
  constructor(private readonly service: SchoolSetupService) {}

  // STUDENT SUBJECT REGISTRATION
  @Post('subjects/register')
  @Roles(UserRole.STUDENT)
  @ApiOperation({
    summary: 'Student registers their subjects for the current term',
    description:
      'Compulsory subjects are auto-included. Only elective IDs need to be submitted.',
  })
  registerSubjects(
    @CurrentUser() user: { id: string },
    @Body() dto: RegisterSubjectsDto,
  ) {
    return this.service.registerSubjectsForStudent(dto, user.id);
  }

  @Put('subjects/register')
  @Roles(UserRole.STUDENT)
  @ApiOperation({
    summary: 'Update subject registration — replace elective selections',
  })
  updateRegistration(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateSubjectRegistrationDto,
  ) {
    return this.service.updateSubjectRegistration(dto, user.id);
  }

  @Get('subjects/register/me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'View your current subject registration' })
  getMyRegistration(@CurrentUser() user: { id: string }) {
    return this.service.getStudentRegistration(user.id);
  }

  @Get('subjects/register/:studentId')
  @Roles(...ADMIN_ROLES, UserRole.TEACHER)
  @ApiOperation({ summary: 'View a specific student subject registration' })
  getStudentRegistration(@Param('studentId') studentId: string) {
    return this.service.getStudentRegistration(studentId);
  }

  // Overview
  @Get('overview')
  // @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary: 'Get full school structure setup overview for the dashboard',
  })
  getOverview() {
    return this.service.getAcademicSessions();
  }

  // Academic Sessions
  // Create Academic Session
  @Post('academic-sessions')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary: 'Create a new academic session, example: "2026/2027"',
  })
  createAcademicSession(@Body() dto: CreateAcademicSessionDto) {
    return this.service.createAcademicSession(dto);
  }

  // Get All Academic Sessions
  @Get('academic-sessions')
  @ApiOperation({
    summary: 'Get all academic sessions',
  })
  getAcademicSessions() {
    return this.service.getAcademicSessions();
  }

  // Get Current Academic Session
  @Get('academic-sessions/current')
  @ApiOperation({
    summary: 'Get the current academic session',
  })
  getCurrentAcademicSession() {
    return this.service.getCurrentAcademicSession();
  }

  // Set current academic session as current
  @Patch('academic-sessions/:id/set-current')
  @Roles(...ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set an academic session as current active academic session',
  })
  setCurrentAcademicSession(@Param('id') id: string) {
    return this.service.markAcademicSessionAsCurrent(id);
  }

  // Update Academic Session
  @Patch('academic-sessions/:id')
  @Roles(...ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update an academic session, example: "2026/2027"',
  })
  updateAcademicSession(
    @Param('id') id: string,
    @Body() dto: UpdateAcademicSessionDto,
  ) {
    return this.service.updateAcademicSession(id, dto);
  }

  // Delete Academic Session
  @Delete('academic-sessions/:id')
  @Roles(UserRole.SCHOOL_OWNER, UserRole.SUPER_ADMIN, UserRole.PRINCIPAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete an academic session',
  })
  deleteAcademicSession(@Param('id') id: string) {
    return this.service.deleteAcademicSession(id);
  }

  // TERMS
  // Create Term
  @Post('terms')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary: 'Create a new term',
  })
  createTerm(@Body() dto: CreateTermDto) {
    return this.service.createTerm(dto);
  }

  // Get All Terms
  @Get('academic-sessions/:academicSessionId/terms')
  @ApiOperation({
    summary: 'Get all terms for a specific academic session',
  })
  getTerms(@Param('academicSessionId') academicSessionId: string) {
    return this.service.getTermsByAcademicSession(academicSessionId);
  }

  // Get Current Term
  @Get('terms/current')
  @ApiOperation({
    summary: 'Get the current term',
  })
  getCurrentTerm() {
    return this.service.getCurrentTerm();
  }

  // Set current term as current
  @Patch('terms/:id/set-current')
  @Roles(...ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set the current term as current',
  })
  setCurrentTerm(@Param('id') id: string) {
    return this.service.setCurrentTerm(id);
  }

  // Update Term
  @Patch('terms/:id')
  @Roles(...ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a term',
  })
  updateTerm(@Param('id') id: string, @Body() dto: UpdateTermDto) {
    return this.service.updateTerm(id, dto);
  }

  // TODO: Delete Term

  // DEPARTMENTS
  // Create Department
  @Post('departments')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary: 'Create a new department, example: "Sciences"',
  })
  createDepartment(@Body() dto: CreateDepartmentDto) {
    return this.service.createDepartment(dto);
  }

  // Get All Departments
  @Get('departments')
  @ApiOperation({
    summary: 'Get all departments',
  })
  getDepartments() {
    return this.service.getDepartments();
  }

  // Update Department
  @Patch('departments/:id')
  @Roles(...ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a department',
  })
  updateDepartment(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.service.updateDepartment(id, dto);
  }

  // Delete Department
  @Delete('departments/:id')
  @Roles(UserRole.SCHOOL_OWNER, UserRole.SUPER_ADMIN, UserRole.PRINCIPAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a department',
  })
  deleteDepartment(@Param('id') id: string) {
    return this.service.deleteDepartment(id);
  }

  // CLASSES
  // Create Class
  @Post('classes')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary: 'Create a new class, example: "JSS 1 Gold"',
  })
  createClass(@Body() dto: CreateClassDto) {
    return this.service.createClass(dto);
  }

  // Get All Classes
  @Get('classes')
  @ApiOperation({ summary: 'List all classes, optionally filtered by level' })
  @ApiQuery({ name: 'level', required: false, example: 'JSS' })
  getClasses(@Query('level') level?: string) {
    return this.service.getClasses(level);
  }

  // Get Class by ID
  @Get('classes/:id')
  @ApiOperation({ summary: 'Get a class with its students and subjects' })
  getClassById(@Param('id') id: string) {
    return this.service.getClassById(id);
  }

  // Update Class
  @Patch('classes/:id')
  @Roles(...ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a class',
  })
  updateClass(@Param('id') id: string, @Body() dto: UpdateClassDto) {
    return this.service.updateClass(id, dto);
  }

  // Delete Class
  @Delete('classes/:id')
  @Roles(UserRole.SCHOOL_OWNER, UserRole.SUPER_ADMIN, UserRole.PRINCIPAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a class',
  })
  deleteClass(@Param('id') id: string) {
    return this.service.deleteClass(id);
  }

  // Put student in class
  @Post('classes/:classId/students')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Assign a single student to a class' })
  assignStudent(
    @Param('classId') classId: string,
    @Body() dto: AssignStudentToClassDto,
  ) {
    return this.service.assignStudentToClass(classId, dto.student_user_id);
  }

  // SUBJECTS
  // Create Subject
  @Post('subjects')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary: 'Create a new subject, example: "Mathematics"',
  })
  createSubject(@Body() dto: CreateSubjectDto) {
    return this.service.createSubject(dto);
  }

  // Get All Subjects
  @Get('subjects')
  @ApiOperation({
    summary: 'List all subjects, optionally filtered by department',
  })
  getSubjects(@Query('departmentId') departmentId?: string) {
    return this.service.getSubjects(departmentId);
  }

  // Get Subject by ID
  @Get('subjects/:id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary: 'Get a subject by ID',
  })
  getSubjectById(@Param('id') id: string) {
    return this.service.getSubjectsById(id);
  }
  // Update Subject
  @Patch('subjects/:id')
  @Roles(...ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a subject name, title, or description',
  })
  updateSubject(@Param('id') id: string, @Body() dto: UpdateSubjectDto) {
    return this.service.updateSubject(id, dto);
  }

  // Delete Subject
  @Delete('subjects/:id')
  @Roles(UserRole.SCHOOL_OWNER, UserRole.SUPER_ADMIN, UserRole.PRINCIPAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a subject',
  })
  deleteSubject(@Param('id') id: string) {
    return this.service.deleteSubject(id);
  }

  // CLASS - SUBJECT ASSIGNMENTS
  // Assign subject to class
  @Post('classes/:classId/subjects')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary: 'Assign a subject to a class',
  })
  @ApiParam({
    name: 'classId',
    description: 'The ID of the class to assign the subject to',
  })
  assignSubjectToClass(
    @Param('classId') classId: string,
    @Body() dto: AssignSubjectToClassDto,
  ) {
    return this.service.assignSubjectToClass(dto, classId);
  }

  // Bulk assign subjects to class
  @Post('classes/:classId/subjects/bulk')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary: 'Bulk assign multiple subjects to a class at once',
  })
  bulkAssignSubjectsToClass(
    @Param('classId') classId: string,
    @Body() dto: BulkAssignSubjectsDto,
  ) {
    return this.service.bulkAssignSubjectsToClass(dto, classId);
  }

  // Assign teacher to class
  // @Post('classes/:classId/teachers')
  // @Roles(...ADMIN_ROLES)
  // @HttpCode(HttpStatus.OK)
  // @ApiOperation({
  //   summary: 'Assign a teacher to a subject in a specific class',
  // })
  // assignTeacherToClass(
  //   @Param('classId') classId: string,
  //   @Param('subjectId') subjectId: string,
  //   @Body() dto: AssignTeacherToSubjectDto,
  // ) {
  //   return this.service.assignTeacherToClassSubject(dto, classId, subjectId);
  // }

  // Remove Subject from Class
  @Delete('classes/:classId/subjects/:subjectId')
  @Roles(...ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove a subject from a class',
  })
  removeSubjectFromClass(
    @Param('classId') classId: string,
    @Param('subjectId') subjectId: string,
  ) {
    return this.service.removeSubjectFromClass(subjectId, classId);
  }

  // Assign teacher to subject
  @Post('classes/:classId/subjects/:subjectId/teachers')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary: 'Assign a teacher to a subject in a specific class',
  })
  assignTeacher(
    @Param('classId') classId: string,
    @Param('subjectId') subjectId: string,
    @Body() dto: AssignTeacherToSubjectDto,
  ) {
    return this.service.assignTeacherToClassSubject(
      dto.teacher_id,
      classId,
      subjectId,
    );
  }

  // Bulk assign teachers to subject
  @Post('classes/:classId/subjects/:subjectId/teachers/bulk')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary: 'Bulk assign multiple teachers to a subject in a class',
  })
  bulkAssignTeachers(
    @Param('classId') classId: string,
    @Param('subjectId') subjectId: string,
    @Body() dto: BulkAssignTeachersDto,
  ) {
    return this.service.bulkAssignTeachersToClassSubjects(
      dto,
      classId,
      subjectId,
    );
  }

  // Unassign teacher from subject
  @Delete('classes/:classId/subjects/:subjectId/teachers/:teacherId')
  @Roles(...ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a teacher from a subject in a class' })
  removeTeacher(
    @Param('classId') classId: string,
    @Param('subjectId') subjectId: string,
    @Param('teacherId') teacherId: string,
  ) {
    return this.service.removeTeacherFromClassSubject(
      teacherId,
      classId,
      subjectId,
    );
  }
}
