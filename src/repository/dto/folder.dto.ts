import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RepositoryScope } from 'src/generated/prisma/enums';

// Scopes that REQUIRE a scope_id
const SCOPED_REPOSITORIES: RepositoryScope[] = [
  RepositoryScope.CLASS_DOCUMENTS,
  RepositoryScope.SUBJECT_DOCUMENTS,
  RepositoryScope.DEPARTMENT_DOCUMENTS,
  RepositoryScope.STAFF_RECORDS,
  RepositoryScope.TUITION_PAYMENTS,
  RepositoryScope.STAFF_SALARY,
  RepositoryScope.HEALTH_RECORDS,
  RepositoryScope.COUNSELING_RECORDS,
  RepositoryScope.DISCIPLINARY_RECORDS,
];

// Scopes that do NOT need a scope_id, they are school-wide
// const SCHOOL_WIDE_REPOSITORIES: RepositoryScope[] = [
//   RepositoryScope.PAST_QUESTIONS,
//   RepositoryScope.SCHOOL_DOCUMENTS,
//   RepositoryScope.LIBRARY_RECORDS,
//   RepositoryScope.LABORATORY_RECORDS,
//   RepositoryScope.INVENTORY_RECORDS,
//   RepositoryScope.MAINTENANCE_RECORDS,
//   RepositoryScope.VISITOR_LOGS,
//   RepositoryScope.PTA_MEETINGS,
//   RepositoryScope.STAFF_MEETINGS,
//   RepositoryScope.SCHOOL_EVENTS,
//   RepositoryScope.EXTRACURRICULAR,
//   RepositoryScope.SPORT_RECORDS,
//   RepositoryScope.SCHOOL_EXPENSES,
// ];

export class CreateFolderDto {
  @ApiProperty({ example: 'Week 1 Materials' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: RepositoryScope })
  @IsEnum(RepositoryScope)
  scope: RepositoryScope;

  @ApiPropertyOptional({
    description: [
      'The ID of the resource this folder is scoped to.',
      'Required for: CLASS_DOCUMENTS (classId), SUBJECT_DOCUMENTS (subjectId),',
      'DEPARTMENT_DOCUMENTS (departmentId), STAFF_RECORDS (userId),',
      'TUITION_PAYMENTS (studentUserId), STAFF_SALARY (staffUserId),',
      'HEALTH_RECORDS (studentUserId), COUNSELING_RECORDS (studentUserId),',
      'DISCIPLINARY_RECORDS (studentUserId).',
      'Leave empty for school-wide scopes like PAST_QUESTIONS, SCHOOL_DOCUMENTS etc.',
    ].join(' '),
    example: 'clx1234abcd',
  })
  @ValidateIf((o: CreateFolderDto) => SCOPED_REPOSITORIES.includes(o.scope))
  @IsString()
  @IsNotEmpty({ message: 'scope_id is required for this repository scope' })
  scope_id?: string;

  @ApiPropertyOptional({ description: 'Parent folder ID for nested folders' })
  @IsString()
  @IsOptional()
  parent_folder_id?: string;
}

export class RenameFolderDto {
  @ApiProperty({ example: 'Week 1 Introduction' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class ListFoldersDto {
  @ApiProperty({
    enum: RepositoryScope,
    description: 'Which repository section to list folders from',
  })
  @IsEnum(RepositoryScope)
  scope: RepositoryScope;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  scope_id?: string;

  @ApiPropertyOptional({
    description: 'Parent folder ID — leave empty for root folders',
  })
  @IsString()
  @IsOptional()
  parent_folder_id?: string;
}
