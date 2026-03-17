import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignStudentToClassDto {
  @ApiProperty({
    description: 'The User ID of the student to be assigned to the class',
  })
  @IsString()
  @IsNotEmpty()
  student_user_id: string;
}

export class TransferStudentToClassDto {
  @ApiProperty({
    description: 'The User ID of the student to be transferred to the class',
  })
  @IsString()
  @IsNotEmpty()
  student_user_id: string;

  @ApiPropertyOptional({
    description: 'Reason for transfer — stored for record keeping',
    example: 'Parent request',
  })
  @IsString()
  @IsOptional()
  class_id: string;
}

export class BulkAssignStudentsDto {
  @ApiProperty({
    description: 'Array of student user IDs to assign to this class',
    example: ['student-id-1', 'student-id-2'],
  })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  student_user_ids: string[];
}
