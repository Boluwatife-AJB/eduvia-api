import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsInt,
  Min,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DayOfWeek } from 'src/generated/prisma/enums';

export class CreateTutorialClassDto {
  @ApiProperty({ example: 'Pre-exam Mathematics Revision' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Subject ID' })
  @IsString()
  @IsNotEmpty()
  subject_id: string;

  @ApiPropertyOptional({
    description: 'Limit to a specific class — leave empty for open session',
  })
  @IsString()
  @IsOptional()
  class_id?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'Library Room 2' })
  @IsString()
  @IsOptional()
  venue?: string;

  @ApiProperty({ example: '2025-03-20T08:00:00.000Z' })
  @IsDateString()
  start_time: string;

  @ApiProperty({ example: '2025-03-20T10:00:00.000Z' })
  @IsDateString()
  end_time: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  is_recurring?: boolean;

  @ApiPropertyOptional({
    enum: DayOfWeek,
    description: 'Required if isRecurring is true',
  })
  @IsEnum(DayOfWeek)
  @IsOptional()
  recurring_day?: DayOfWeek;

  @ApiPropertyOptional({ example: 30 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  max_students?: number;
}

export class UpdateTutorialClassDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  venue?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  start_time?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  end_time?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  max_students?: number;
}
