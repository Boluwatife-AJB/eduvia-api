import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsString,
} from 'class-validator';
import { SubjectType } from 'src/generated/prisma/enums';

export class AssignSubjectToClassDto {
  @ApiProperty({
    enum: SubjectType,
    example: SubjectType.COMPULSORY,
    description:
      'Whether this subject is compulsory or elective for students in this class',
  })
  @IsEnum(SubjectType)
  @IsNotEmpty()
  subject_type: SubjectType;

  @ApiProperty({ description: 'The ID of the subject to assign to the class' })
  @IsString()
  @IsNotEmpty()
  subject_id: string;
}

export class AssignTeacherToSubjectDto {
  @ApiProperty({
    description: 'Teacher User ID',
  })
  @IsString()
  @IsNotEmpty()
  teacher_id: string;
}

export class RegisterSubjectsDto {
  @ApiProperty({
    description: 'Array of classSubject IDs  the student wants to register',
    example: ['classSubject-id-1', 'classSubject-id-2'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  class_subject_ids: string[];
}

export class BulkAssignSubjectsDto {
  @ApiProperty({
    type: 'array',
    description: 'Array of teacher User IDs to assign to the subject',
    example: [
      {
        subject_id: 'subject-id-1',
        subject_type: SubjectType.COMPULSORY,
      },
      {
        subject_id: 'subject-id-2',
        subject_type: SubjectType.ELECTIVE,
      },
    ],
  })
  @IsArray()
  @ArrayNotEmpty()
  subjects: AssignSubjectToClassDto[];
}

export class BulkAssignTeachersDto {
  @ApiProperty({
    description: 'Array of teacher User IDs to assign to the subjects',
    example: ['teacher-user-id-1', 'teacher-user-id-2'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  teacher_ids: string[];
}

export class UpdateSubjectRegistrationDto {
  @ApiProperty({
    description:
      'The complete updated list of ClassSubject IDs (replaces existing elective selections)',
    example: ['class-subject-id-1', 'class-subject-id-3'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  class_subject_ids: string[];
}
