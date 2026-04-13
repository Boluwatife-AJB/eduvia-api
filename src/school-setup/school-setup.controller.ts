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
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/generated/prisma/client';
import {
  CreateAcademicSessionDto,
  UpdateAcademicSessionDto,
} from './dto/academic-session.dto';
import {
  AssignStudentToClassDto,
  TransferStudentToClassDto,
} from './dto/assign-student.dto';
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

  // Overview
  @Get('overview')
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

  // Delete Term
  @Delete('terms/:id')
  @Roles(UserRole.SCHOOL_OWNER, UserRole.SUPER_ADMIN, UserRole.PRINCIPAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a term' })
  async deleteTerm(@Param('id') id: string) {
    return await this.service.deleteTerm(id);
  }

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

  // Get classes with just id and the name of the class
  @Get('classes/names')
  @ApiOperation({
    summary: 'Get all classes with just id and the name of the class',
  })
  getClassesWithIdAndName() {
    return this.service.getClassesWithIdAndName();
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

  // Subjects
  @Post('subjects')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Create a subject — unique per code + department' })
  createSubject(@Body() dto: CreateSubjectDto) {
    return this.service.createSubject(dto);
  }

  @Get('subjects')
  @ApiOperation({ summary: 'List all subjects' })
  getSubjects(@Query('departmentId') departmentId?: string) {
    return this.service.getSubjects(departmentId);
  }

  @Get('subjects/:id')
  @ApiOperation({ summary: 'Get a subject by id' })
  getSubjectsById(@Param('id') id: string) {
    return this.service.getSubjectById(id);
  }

  @Put('subjects/:id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Update subject name, title or description' })
  updateSubject(@Param('id') id: string, @Body() dto: UpdateSubjectDto) {
    return this.service.updateSubject(id, dto);
  }

  @Delete('subjects/:id')
  @Roles(UserRole.SCHOOL_OWNER, UserRole.PRINCIPAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a subject' })
  deleteSubject(@Param('id') id: string) {
    return this.service.deleteSubject(id);
  }

  // Class Subject Assignments
  @Post('classes/:classId/subjects')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary: 'Assign a subject to a class as compulsory or elective',
  })
  assignSubject(
    @Param('classId') classId: string,
    @Body() dto: AssignSubjectToClassDto,
  ) {
    return this.service.assignSubjectToClass(dto, classId);
  }

  @Post('classes/:classId/subjects/bulk')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Bulk assign subjects to a class' })
  bulkAssignSubjects(
    @Param('classId') classId: string,
    @Body() dto: BulkAssignSubjectsDto,
  ) {
    return this.service.bulkAssignSubjectsToClass(dto, classId);
  }

  @Delete('classes/:classId/subjects/:subjectId')
  @Roles(...ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a subject from a class' })
  removeSubject(
    @Param('classId') classId: string,
    @Param('subjectId') subjectId: string,
  ) {
    return this.service.removeSubjectFromClass(subjectId, classId);
  }

  // Teacher Subject Assignments
  @Post('classes/:classId/subjects/:subjectId/teachers')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Assign a single teacher to a subject in a class' })
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

  // Student Subject Registrations
  @Post('subjects/register')
  @Roles(UserRole.STUDENT)
  @ApiOperation({
    summary: 'Student registers their subjects for the current term',
    description:
      'Compulsory subjects are auto-included. Only elective IDs need to be submitted.',
  })
  registerSubjectsForStudent(
    @CurrentUser() user: { id: string },
    @Body() dto: RegisterSubjectsDto,
  ) {
    return this.service.registerSubjectsForStudent(dto, user.id);
  }

  @Put('subjects/update')
  @Roles(UserRole.STUDENT)
  @ApiOperation({
    summary: 'Update subject registration -  replace elective selections',
  })
  updateSubjectRegistration(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateSubjectRegistrationDto,
  ) {
    return this.service.updateSubjectRegistration(dto, user.id);
  }

  @Get('subjects/register/me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'View your current subject registration' })
  getMySubjectRegistration(@CurrentUser() user: { id: string }) {
    return this.service.getStudentRegistration(user.id);
  }

  @Get('subjects/register/:studentId')
  @Roles(...ADMIN_ROLES, UserRole.TEACHER)
  @ApiOperation({ summary: 'View a specific student subject registration' })
  getStudentSubjectRegistration(@Param('studentId') studentId: string) {
    return this.service.getStudentRegistration(studentId);
  }

  @Patch('classes/:classId/students/transfer')
  @Roles(...ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Transfer a student from their current class to this class',
  })
  transferStudent(
    @Param('classId') classId: string,
    @Body() dto: TransferStudentToClassDto,
  ) {
    return this.service.transferStudentToClass(
      classId,
      dto.student_user_id,
      dto.reason,
    );
  }

  @Delete('students/:studentUserId/class')
  @Roles(...ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a student from their current class' })
  removeStudentFromClass(@Param('studentUserId') studentUserId: string) {
    return this.service.removeStudentFromClass(studentUserId);
  }
}
