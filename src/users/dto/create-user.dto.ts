import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Gender, UserRole } from '../../generated/prisma/client';

export class CreateUserDto {
  @ApiProperty({ enum: UserRole, example: UserRole.STUDENT })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiProperty({ example: 'Adetayo' })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({ example: 'Adelabu' })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  // Image URL

  @ApiPropertyOptional({
    example: 'GFA/2026/0001',
    description:
      'Optional for students/teachers/staff (auto-generated if omitted). Required for guardians. Matric or employee ID format.',
  })
  @ValidateIf(
    (o: CreateUserDto) =>
      o.role === UserRole.GUARDIAN || o.role === UserRole.PARENT,
  )
  @IsNotEmpty({ message: 'identifier is required for guardians and parents' })
  @IsString()
  identifier?: string;

  @ApiProperty({ example: 'adetayoadelabu@greenfieldacademy.edu.ng' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '+2348061234567' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ enum: Gender, example: Gender.MALE })
  @IsEnum(Gender)
  @IsNotEmpty()
  gender: Gender;

  @ApiProperty({
    example: '2007-02-21',
    description: 'Date of birth for students',
  })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  date_of_birth?: Date;

  @ApiProperty({ example: 'Password123', minLength: 8 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  // Student Specific Fields
  @ApiPropertyOptional({
    example: 'GFA/2026/0001',
    description:
      'Optional for students; auto-generated as {slug}/{year}/0001 if omitted',
  })
  @IsOptional()
  @IsString()
  matric_number?: string;

  @ApiPropertyOptional({ example: '2026-09-04' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  admission_date?: string;

  @ApiPropertyOptional({ description: 'Class ID to assign the student to' })
  @IsString()
  @IsOptional()
  class_id?: string;

  // Teacher Specific Fields
  @ApiPropertyOptional({
    description:
      'Optional for teachers; auto-generated as {slug}/TCH/001 if omitted',
  })
  @IsOptional()
  @IsString()
  employee_id?: string;

  @ApiPropertyOptional({ example: 'B.Sc Computer Science' })
  @IsString()
  @IsOptional()
  qualification?: string;

  @ApiPropertyOptional({ example: 'B.Sc Computer Science' })
  @IsString()
  @IsOptional()
  course_of_study?: string;

  @ApiPropertyOptional({ example: 'First Class' })
  @IsString()
  @IsOptional()
  class_of_degree?: string;

  @ApiPropertyOptional({ example: '2026' })
  @IsString()
  @IsOptional()
  year_of_graduation?: string;

  @ApiPropertyOptional({
    example: '2026',
    description:
      'Alternative to year_of_graduation (stored as year_of_graduation on teacher profile)',
  })
  @IsString()
  @IsOptional()
  graduation_date?: string;

  @ApiPropertyOptional({ example: ['subject-id-1', 'subject-id-2'] })
  @IsArray()
  @IsOptional()
  subject_ids?: string[];

  // Staff Specific Fields
  @ApiPropertyOptional({
    description: 'Required when role is a non-teaching staff role',
    example: 'nurse',
  })
  @ValidateIf((object: CreateUserDto) =>
    (
      [
        UserRole.COUNSELOR,
        UserRole.LAB_ATTENDANT,
        UserRole.NURSE,
        UserRole.LIBRARIAN,
        UserRole.BURSAR,
        UserRole.SUPPORT_STAFF,
        UserRole.SECURITY_OFFICER,
        UserRole.OTHER,
      ] as UserRole[]
    ).includes(object.role),
  )
  @IsNotEmpty()
  @IsString()
  staff_type?: string;

  // Guardian / parent specific fields
  @ApiPropertyOptional({ description: 'Required when role is GUARDIAN' })
  @ValidateIf((object: CreateUserDto) => object.role === UserRole.GUARDIAN)
  @IsNotEmpty()
  @IsString()
  guardian_id?: string;

  @ApiPropertyOptional({
    description:
      'Relationship to ward (e.g. father, mother) for GUARDIAN or PARENT',
  })
  @ValidateIf(
    (object: CreateUserDto) =>
      object.role === UserRole.GUARDIAN || object.role === UserRole.PARENT,
  )
  @IsOptional()
  @IsString()
  relationship?: string;

  @ApiPropertyOptional({
    description: 'Student user IDs linked to this parent/guardian',
  })
  @ValidateIf(
    (object: CreateUserDto) =>
      object.role === UserRole.GUARDIAN || object.role === UserRole.PARENT,
  )
  @IsArray()
  @IsOptional()
  ward_ids?: string[];

  @ApiPropertyOptional({
    description: 'Occupation for GUARDIAN or PARENT',
  })
  @ValidateIf(
    (object: CreateUserDto) =>
      object.role === UserRole.GUARDIAN || object.role === UserRole.PARENT,
  )
  @IsOptional()
  @IsString()
  occupation?: string;
}
