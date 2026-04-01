import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Gender, UserRole, UserStatus } from '../../generated/prisma/client';

export class QueryUsersDto {
  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({ enum: UserRole })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @ApiPropertyOptional({
    description: 'Search by name, email, matric number or identifier',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by gender' })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @ApiPropertyOptional({ description: 'Filter by class ID' })
  @IsString()
  @IsOptional()
  class_id?: string;

  // @ApiPropertyOptional({ description: 'Filter by qualification' })
  // @IsString()
  // @IsOptional()
  // qualification?: string;

  // @ApiPropertyOptional({ description: 'Filter by course of study' })
  // @IsString()
  // @IsOptional()
  // course_of_study?: string;

  // @ApiPropertyOptional({ description: 'Filter by class of degree' })
  // @IsString()
  // @IsOptional()
  // class_of_degree?: string;

  // @ApiPropertyOptional({ description: 'Filter by year of graduation' })
  // @IsString()
  // @IsOptional()
  // year_of_graduation?: string;
}

export class QueryParentsDto extends OmitType(QueryUsersDto, [
  'role',
  'class_id',
] as const) {
  @ApiPropertyOptional({
    description: 'Filter by guardian occupation (contains)',
  })
  @IsString()
  @IsOptional()
  occupation?: string;

  @ApiPropertyOptional({
    description:
      'Filter by relationship to ward (contains), e.g. father, mother',
  })
  @IsString()
  @IsOptional()
  relationship?: string;
}

export class QueryTeachersDto extends OmitType(QueryUsersDto, [
  'role',
  'class_id',
] as const) {
  @ApiPropertyOptional({ description: 'Filter by qualification' })
  @IsString()
  @IsOptional()
  qualification?: string;

  @ApiPropertyOptional({ description: 'Filter by course of study' })
  @IsString()
  @IsOptional()
  course_of_study?: string;

  @ApiPropertyOptional({ description: 'Filter by class of degree' })
  @IsString()
  @IsOptional()
  class_of_degree?: string;

  @ApiPropertyOptional({ description: 'Filter by year of graduation' })
  @IsString()
  @IsOptional()
  year_of_graduation?: string;
}

// export class QueryStaffDto extends OmitType(QueryUsersDto, [
//   'role',
//   'class_id',
// ] as const) {
//   @ApiPropertyOptional({ description: 'Filter by staff type' })
//   @IsString()
//   @IsOptional()
//   staff_type?: NonTeachingStaffRole;
// }
