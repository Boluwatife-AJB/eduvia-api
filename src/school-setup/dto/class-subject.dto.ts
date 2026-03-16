import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class AssignSubjectToClassDto {
  @ApiPropertyOptional({
    description: 'The ID of the teacher to assign the subject to',
  })
  @IsString()
  @IsOptional()
  teacher_id?: string;

  @ApiProperty({ description: 'The ID of the subject to assign to the class' })
  @IsString()
  @IsNotEmpty()
  subject_id: string;
}

export class AssignTeacherToClassSubjectDto {
  @ApiProperty({
    description: 'The ID of the teacher to assign to the subject in the class',
  })
  @IsString()
  @IsNotEmpty()
  teacher_id: string;
}

export class BulkAssignSubjectsDto {
  @ApiProperty({
    description: 'Array of subject IDs to assign to this class',
    example: ['subject-id-1', 'subject-id-2'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  subject_ids: string[];
}
