import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { join } from 'path';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { JwtAuthUser } from 'src/auth/strategies/jwt.strategy';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from '../generated/prisma/client';
import {
  ADMIN_ROLES,
  isTenantAdminRole,
  USER_CREATE_ROLES,
} from './policies/user-role-assignment.policy';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import {
  QueryParentsDto,
  QueryTeachersDto,
  QueryUsersDto,
} from './dto/query-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Stats
  @Get('stats')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Get user statistics for the school' })
  @ApiResponse({ status: 200, description: 'User statistics for the school' })
  async getStats() {
    return this.usersService.getSchoolStats();
  }

  // Create User
  @Post()
  @Roles(...USER_CREATE_ROLES)
  @ApiOperation({
    summary:
      "Create a new user (assignable roles depend on the caller's own role)",
  })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({
    status: 400,
    description: 'Bad Request: Invalid request body',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized: Invalid or expired token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Insufficient permissions',
  })
  @ApiResponse({
    status: 409,
    description:
      'Identifier or email already exists. Please use a different identifier or email.',
  })
  @ApiBody({ type: CreateUserDto })
  create(@Body() dto: CreateUserDto, @CurrentUser() admin: JwtAuthUser) {
    return this.usersService.create(dto, {
      id: admin.id,
      role: admin.role,
    });
  }

  // Bulk import users (must be before :id routes)
  // TODO: This route is not working as expected. It is not accepting the CSV file.
  @Post('bulk-import')
  @Roles(...USER_CREATE_ROLES)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk import users from a CSV file' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  bulkImport(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new FileTypeValidator({
            // Accept CSV MIME types (with or without charset, e.g. text/csv; charset=utf-8)
            fileType:
              /^text\/csv|^application\/csv|text\/comma-separated-values|application\/vnd\.ms-excel/,
          }),
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
        ],
      }),
    )
    file: Express.Multer.File,
    @Query('role') role: UserRole,
    @CurrentUser() admin: JwtAuthUser,
  ) {
    return this.usersService.bulkImport(file.buffer, role, admin.role);
  }

  // Get all users
  @Get()
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Get all users by query parameters' })
  // @ApiQuery({ name: 'query', description: 'Query users', type: QueryUsersDto })
  @ApiResponse({ status: 200, description: 'All users' })
  findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  // Get all students
  @Get('students')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Get all students by query parameters' })
  @ApiResponse({ status: 200, description: 'All students' })
  findAllStudents(@Query() query: QueryUsersDto) {
    return this.usersService.findAllStudents(query);
  }

  // Get all teachers
  @Get('teachers')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Get all teachers by query parameters' })
  @ApiResponse({ status: 200, description: 'All teachers' })
  findAllTeachers(@Query() query: QueryTeachersDto) {
    return this.usersService.findAllTeachers(query);
  }

  // Get all parents / guardians
  @Get('parents')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary:
      'Get all parents/guardians (PARENT or GUARDIAN) with optional occupation, relationship, gender filters',
  })
  @ApiResponse({ status: 200, description: 'All parents/guardians' })
  findAllParents(@Query() query: QueryParentsDto) {
    return this.usersService.findAllParents(query);
  }

  // Get non-teaching staff (users with staff_profile, role !== TEACHER)
  @Get('staff')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary:
      'Get staff with staff_profile excluding TEACHER; query params align with teachers (mapped to staff fields)',
  })
  @ApiResponse({ status: 200, description: 'Non-teaching staff' })
  findAllStaff(@Query() query: QueryTeachersDto) {
    return this.usersService.findAllStaffExcludingTeachers(query);
  }

  // Teachers should be able to fetch students assigned to them, students in their class or students offering the subject they teach

  // Download template (static path before :id)
  @Get('templates/:role')
  @Roles(...ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Download template for bulk user import' })
  @ApiParam({ name: 'role', description: 'User role' })
  @ApiResponse({ status: 200, description: 'Template downloaded successfully' })
  downloadTemplate(@Param('role') role: string, @Res() res: Response) {
    const allowedTemplates = ['students', 'teachers', 'guardians', 'staff'];

    if (!allowedTemplates.includes(role)) {
      throw new BadRequestException(`No template for role: ${role}`);
    }

    const filePath = join(
      __dirname,
      'templates',
      `${role.toLowerCase()}-template.csv`,
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${role}-import-template.csv`,
    );

    res.sendFile(filePath);
  }

  // Get user by ID
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  // Update user
  @Put(':id')
  @ApiOperation({ summary: 'Update user profile by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: UpdateUserDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    const isAdmin = isTenantAdminRole(currentUser.role);
    const isSelf = currentUser.id === id;

    if (!isAdmin && !isSelf) {
      throw new ForbiddenException('You can only update your own profile');
    }

    return this.usersService.update(id, dto);
  }

  // Suspend user
  @Patch(':id/suspend')
  @Roles(...ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  suspend(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.usersService.suspend(id, currentUser.id);
  }

  // Reactivate user
  @Patch(':id/reactivate')
  @Roles(...ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  reactivate(@Param('id') id: string) {
    return this.usersService.reactivate(id);
  }

  // Delete user
  @Delete(':id')
  @Roles(
    UserRole.SCHOOL_OWNER,
    UserRole.PRINCIPAL,
    UserRole.SUPER_ADMIN,
    UserRole.HEAD_TEACHER,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  delete(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  // Change user password
  @Patch('/change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change your own password' })
  @ApiBody({ type: ChangePasswordDto })
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() currentUser: { id: string },
  ) {
    return this.usersService.changePassword(currentUser.id, dto);
  }

  // Admin reset password
  @Patch(':id/reset-password')
  @Roles(...ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset user password by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: AdminResetPasswordDto })
  resetPassword(
    @Param('id') id: string,
    @Body() dto: AdminResetPasswordDto,
    @CurrentUser() admin: { id: string },
  ) {
    return this.usersService.adminResetPassword(id, dto, admin.id);
  }
}
