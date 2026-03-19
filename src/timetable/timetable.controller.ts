import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Put,
  Get,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TimetableService } from './timetable.service';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/generated/prisma/client';
import {
  CreateTimetableSlotDto,
  QueryTimetableDto,
  UpdateTimetableSlotDto,
} from './dto/timetable-slot.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import {
  CreateTutorialClassDto,
  UpdateTutorialClassDto,
} from './dto/tutorial-class.dto';

const ADMIN_ROLES = [
  UserRole.SCHOOL_OWNER,
  UserRole.PRINCIPAL,
  UserRole.HEAD_TEACHER,
  UserRole.VICE_PRINCIPAL,
  UserRole.ASST_HEAD_TEACHER,
];

@ApiTags('Timetable')
@Controller('timetable')
@ApiBearerAuth()
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  // TIMETABLE SLOTS (ADMIN ONLY)

  @Post('slots')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Create a new timetable slot' })
  @ApiResponse({
    status: 201,
    description: 'Timetable slot created successfully',
  })
  createTimetableSlot(@Body() dto: CreateTimetableSlotDto) {
    return this.timetableService.createTimetableSlot(dto);
  }

  @Put('slots/:id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Update a timetable slot' })
  @ApiResponse({
    status: 200,
    description: 'Timetable slot updated successfully',
  })
  updateTimetableSlot(
    @Param('id') id: string,
    @Body() dto: UpdateTimetableSlotDto,
  ) {
    return this.timetableService.updateTimetableSlot(id, dto);
  }

  @Delete('slots/:id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Delete a timetable slot' })
  @ApiResponse({
    status: 200,
    description: 'Timetable slot deleted successfully',
  })
  deleteTimetableSlot(@Param('id') id: string) {
    return this.timetableService.deleteSlot(id);
  }

  // TIMETABLE VIEWS
  @Get('school')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary: 'View the full school timetable with optional filters',
  })
  @ApiResponse({
    status: 200,
    description: 'School timetable retrieved successfully',
  })
  getSchoolTimetable(@Query() query: QueryTimetableDto) {
    return this.timetableService.getSchoolTimetable(query);
  }

  @Get('class/:id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary: 'View the timetable for a specific class grouped by day',
  })
  @ApiResponse({
    status: 200,
    description: 'Class timetable retrieved successfully',
  })
  getClassTimetable(@Param('classId') classId: string) {
    return this.timetableService.getClassTimetable(classId);
  }

  @Get('teacher/me')
  @Roles(UserRole.TEACHER)
  @ApiOperation({
    summary: 'Teacher views their own timetable',
  })
  @ApiResponse({
    status: 200,
    description: 'Teacher timetable retrieved successfully',
  })
  getTeacherTimetable(@CurrentUser() user: { id: string }) {
    return this.timetableService.getTeacherTimetable(user.id);
  }

  @Get('student/me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({
    summary: 'Student views their own timetable',
  })
  @ApiResponse({
    status: 200,
    description: 'Student timetable retrieved successfully',
  })
  getStudentTimetable(@CurrentUser() user: { id: string }) {
    return this.timetableService.getStudentTimetable(user.id);
  }

  @Get('teacher/:teacherId')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: "Admin views a specific teacher's timetable" })
  @ApiResponse({
    status: 200,
    description: "Teacher's timetable retrieved successfully",
  })
  getTeacherTimetableByAdmin(@Param('teacherId') teacherId: string) {
    return this.timetableService.getTeacherTimetable(teacherId);
  }

  @Get('student/:studentId')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: "Admin views a specific student's timetable" })
  @ApiResponse({
    status: 200,
    description: "Student's timetable retrieved successfully",
  })
  getStudentTimetableByAdmin(@Param('studentId') studentId: string) {
    return this.timetableService.getStudentTimetable(studentId);
  }

  // TUTORIAL CLASSES
  @Post('tutorials')
  @Roles(UserRole.TEACHER)
  @ApiOperation({ summary: 'Create a new tutorial class' })
  @ApiResponse({
    status: 201,
    description: 'Tutorial class created successfully',
  })
  createTutorialClass(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateTutorialClassDto,
  ) {
    return this.timetableService.createTutorialClass(user.id, dto);
  }

  @Put('tutorials/:id')
  @Roles(UserRole.TEACHER)
  @ApiOperation({ summary: 'Update a tutorial class' })
  @ApiResponse({
    status: 200,
    description: 'Tutorial class updated successfully',
  })
  updateTutorialClass(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateTutorialClassDto,
  ) {
    return this.timetableService.updateTutorialClass(id, user.id, dto);
  }

  @Delete('tutorials/:id')
  @Roles(UserRole.TEACHER)
  @ApiOperation({ summary: 'Delete a tutorial class' })
  @ApiResponse({
    status: 200,
    description: 'Tutorial class deleted successfully',
  })
  deleteTutorialClass(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.timetableService.deleteTutorialClass(id, user.id);
  }

  @Get('tutorials/me')
  @Roles(UserRole.TEACHER)
  @ApiOperation({ summary: 'Teacher views their own tutorial classes' })
  @ApiResponse({
    status: 200,
    description: 'Teacher tutorial classes retrieved successfully',
  })
  getTeacherTutorialClasses(@CurrentUser() user: { id: string }) {
    return this.timetableService.getTutorialClassByTeacher(user.id);
  }
}
