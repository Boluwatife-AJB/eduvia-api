import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Adetayo' })
  @IsString()
  @IsOptional()
  first_name?: string;

  @ApiPropertyOptional({ example: 'Adelabu' })
  @IsString()
  @IsOptional()
  last_name?: string;

  @ApiPropertyOptional({ example: '+2348061234567' })
  @IsString()
  @IsOptional()
  phone_number?: string;

  @ApiPropertyOptional({ example: 'adetayoadelabu@greenfieldacademy.edu.ng' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  avatar?: string;

  // Teacher Profile Updates
  @ApiPropertyOptional({ example: 'B.Sc Computer Science' })
  @IsString()
  @IsOptional()
  qualification?: string;

  @ApiPropertyOptional({ example: ['subject-id-1', 'subject-id-2'] })
  @IsArray()
  @IsOptional()
  subject_ids?: string[];

  @ApiPropertyOptional({ example: 'department-id-1' })
  @IsString()
  @IsOptional()
  department_id?: string;

  // Admin Only Updates
  @ApiPropertyOptional({ example: 'class-id-1' })
  @IsString()
  @IsOptional()
  class_id?: string;
}
