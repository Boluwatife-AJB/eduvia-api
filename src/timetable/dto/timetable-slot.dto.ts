import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { DayOfWeek } from 'src/generated/prisma/enums';

// Validates time is in HH:MM 24-hour format
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateTimetableSlotDto {
  @ApiProperty({ description: 'Class ID' })
  @IsString()
  @IsNotEmpty()
  class_id: string;

  @ApiProperty({ description: 'Subject ID' })
  @IsString()
  @IsNotEmpty()
  subject_id: string;

  @ApiProperty({ description: 'Teacher user ID' })
  @IsString()
  @IsNotEmpty()
  teacher_id: string;

  @ApiProperty({ enum: DayOfWeek, example: DayOfWeek.MONDAY })
  @IsEnum(DayOfWeek)
  day_of_week: DayOfWeek;

  @ApiProperty({ example: '08:00', description: '24-hour format HH:MM' })
  @IsString()
  @Matches(TIME_REGEX, {
    message: 'startTime must be in HH:MM format e.g. 08:00',
  })
  start_time: string;

  @ApiProperty({ example: '09:00', description: '24-hour format HH:MM' })
  @IsString()
  @Matches(TIME_REGEX, {
    message: 'endTime must be in HH:MM format e.g. 09:00',
  })
  end_time: string;

  @ApiPropertyOptional({ example: 'Room 12' })
  @IsString()
  @IsOptional()
  venue?: string;
}

export class UpdateTimetableSlotDto {
  @ApiPropertyOptional({ enum: DayOfWeek })
  @IsEnum(DayOfWeek)
  @IsOptional()
  day_of_week?: DayOfWeek;

  @ApiPropertyOptional({ example: '09:00' })
  @IsString()
  @Matches(TIME_REGEX, { message: 'startTime must be in HH:MM format' })
  @IsOptional()
  start_time?: string;

  @ApiPropertyOptional({ example: '10:00' })
  @IsString()
  @Matches(TIME_REGEX, { message: 'endTime must be in HH:MM format' })
  @IsOptional()
  end_time?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  teacher_id?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  venue?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

export class QueryTimetableDto {
  @ApiPropertyOptional({ description: 'Filter by class ID' })
  @IsString()
  @IsOptional()
  class_id?: string;

  @ApiPropertyOptional({ description: 'Filter by teacher user ID' })
  @IsString()
  @IsOptional()
  teacher_id?: string;

  @ApiPropertyOptional({ enum: DayOfWeek, description: 'Filter by day' })
  @IsEnum(DayOfWeek)
  @IsOptional()
  day_of_week?: DayOfWeek;
}
