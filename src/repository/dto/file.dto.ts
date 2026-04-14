import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidateIf,
} from 'class-validator';
import { RepositoryScope } from 'src/generated/prisma/enums';

// Scopes that require a scope_id
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

export class CreateRepositoryFileDto {
  @ApiProperty({
    enum: RepositoryScope,
    description: 'Which repository section this file belongs to',
    example: RepositoryScope.CLASS_DOCUMENTS,
  })
  @IsNotEmpty({ message: 'scope is required' })
  @IsEnum(RepositoryScope)
  scope: RepositoryScope;

  @ApiPropertyOptional({
    description: [
      'The ID of the specific resource this file is scoped to.',
      '',
      'What to pass per scope:',
      '  CLASS_DOCUMENTS      → classId (from GET /school-setup/classes)',
      '  SUBJECT_DOCUMENTS    → subjectId (from GET /school-setup/subjects)',
      '  DEPARTMENT_DOCUMENTS → departmentId (from GET /school-setup/departments)',
      '  STAFF_RECORDS        → userId of the staff member (from GET /users/:id)',
      '  TUITION_PAYMENTS     → userId of the student (from GET /users/:id)',
      '  STAFF_SALARY         → userId of the staff member (from GET /users/:id)',
      '  HEALTH_RECORDS       → userId of the student (from GET /users/:id)',
      '  COUNSELING_RECORDS   → userId of the student (from GET /users/:id)',
      '  DISCIPLINARY_RECORDS → userId of the student (from GET /users/:id)',
      '',
      'Leave empty for school-wide scopes:',
      '  PAST_QUESTIONS, SCHOOL_DOCUMENTS, LIBRARY_RECORDS, LABORATORY_RECORDS,',
      '  INVENTORY_RECORDS, MAINTENANCE_RECORDS, VISITOR_LOGS, PTA_MEETINGS,',
      '  STAFF_MEETINGS, SCHOOL_EVENTS, EXTRACURRICULAR, SPORT_RECORDS, SCHOOL_EXPENSES',
    ].join('\n'),
    example: 'clx1234abcd',
  })
  @ValidateIf((o: CreateRepositoryFileDto) =>
    SCOPED_REPOSITORIES.includes(o.scope),
  )
  @IsString()
  @IsNotEmpty({ message: 'scope_id is required for this repository scope' })
  scope_id?: string;

  @ApiPropertyOptional({
    description:
      'Folder ID to place this file in. Leave empty to place at root of the scope.',
  })
  @IsString()
  @IsOptional()
  folder_id?: string;

  @ApiProperty({
    description: 'Display name for the file in the repository',
    example: 'Mathematics Past Question 2023',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 'WASSCE Mathematics Past Paper 2023',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Tags to make the file more searchable',
    example: ['mathematics', 'wassce', '2023', 'past-question'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({
    description:
      'The fileUrl returned from POST /upload or POST /upload/confirm',
    example:
      'https://uploads.yourdomain.com/tenant-id/repository/uuid-maths-paper.pdf',
  })
  @IsUrl({}, { message: 'fileUrl must be a valid URL' })
  @IsNotEmpty()
  file_url: string;

  @ApiProperty({
    description:
      'The fileKey returned from POST /upload or POST /upload/confirm',
    example: 'tenant-id/repository/uuid-maths-paper.pdf',
  })
  @IsString()
  @IsNotEmpty()
  file_key: string;

  @ApiPropertyOptional({
    description: [
      'Optional auto-archive date.',
      'After this date the file becomes ARCHIVED and inaccessible to students.',
      'Useful for school circulars that are only relevant for a specific period.',
    ].join(' '),
    example: '2025-07-31T00:00:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  expires_at?: string;

  @ApiPropertyOptional({
    description: 'Note describing this initial version',
    example: 'Original document',
  })
  @IsString()
  @IsOptional()
  change_note?: string;

  @ApiPropertyOptional({
    description: [
      'The module this file is linked to.',
      'Used to attach a file to an existing structured record.',
      'Examples: "payroll", "payment", "health", "disciplinary"',
    ].join(' '),
    example: 'payroll',
  })
  @IsString()
  @IsOptional()
  linked_record_type?: string;

  @ApiPropertyOptional({
    description: 'The ID of the linked record in the module above',
    example: 'payroll-record-id',
  })
  @IsString()
  @IsOptional()
  linked_record_id?: string;
}

export class UpdateFileMetaDto {
  @ApiPropertyOptional({
    description: 'New display name for the file',
    example: 'Mathematics Past Paper 2023 — Updated',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Replaces the existing tags entirely',
    example: ['mathematics', 'wassce', '2023'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Update or set the auto-archive date',
    example: '2025-12-31T00:00:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  expires_at?: string;
}

export class AddNewVersionDto {
  @ApiProperty({
    description:
      'The fileUrl returned from POST /upload or POST /upload/confirm',
    example:
      'https://uploads.yourdomain.com/tenant-id/repository/uuid-maths-paper-v2.pdf',
  })
  @IsUrl({}, { message: 'fileUrl must be a valid URL' })
  @IsNotEmpty()
  file_url: string;

  @ApiProperty({
    description:
      'The fileKey returned from POST /upload or POST /upload/confirm',
    example: 'tenant-id/repository/uuid-maths-paper-v2.pdf',
  })
  @IsString()
  @IsNotEmpty()
  file_key: string;

  @ApiPropertyOptional({
    description: 'What changed in this version',
    example: 'Added marking scheme for section B',
  })
  @IsString()
  @IsOptional()
  change_note?: string;
}

export class GenerateShareLinkDto {
  @ApiProperty({
    description: 'How long the share link remains valid',
    enum: ['1h', '24h', '7d'],
    example: '24h',
  })
  @IsString()
  @IsIn(['1h', '24h', '7d'], { message: 'expiry must be one of: 1h, 24h, 7d' })
  expiry: '1h' | '24h' | '7d';

  @ApiPropertyOptional({
    description:
      'Maximum number of times this link can be accessed before it stops working',
    example: 10,
  })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  max_access?: number;
}

export class ListFilesDto {
  @ApiPropertyOptional({
    enum: RepositoryScope,
    description: 'Filter by repository scope',
  })
  @IsEnum(RepositoryScope)
  @IsOptional()
  scope?: RepositoryScope;

  @ApiPropertyOptional({
    description:
      'Filter by scope ID — required when scope is a scoped repository',
  })
  @IsString()
  @IsOptional()
  scope_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by folder ID to list files in a specific folder',
  })
  @IsString()
  @IsOptional()
  folder_id?: string;

  @ApiPropertyOptional({
    description: 'Search by file name, description or tags',
    example: 'mathematics 2023',
  })
  @IsString()
  @IsOptional()
  search?: string;
}
