import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsUrl,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LectureContentType } from 'src/generated/prisma/enums';

export class CreateLectureDto {
  @ApiProperty({ example: 'Introduction to Algebra' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    example: 'This lecture covers the basics of algebraic expressions',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Class ID this lecture is for' })
  @IsString()
  @IsNotEmpty()
  class_id: string;

  @ApiProperty({ description: 'Subject ID this lecture belongs to' })
  @IsString()
  @IsNotEmpty()
  subject_id: string;

  @ApiProperty({ enum: LectureContentType })
  @IsEnum(LectureContentType)
  @IsNotEmpty()
  content_type: LectureContentType;

  // For FILE-based types (VIDEO, PDF, AUDIO, SLIDES)
  // This is the fileUrl returned from POST /upload or POST /upload/confirm
  @ApiPropertyOptional({
    example: 'https://uploads.yourdomain.com/tenant-id/lectures/uuid-file.pdf',
    description:
      'The fileUrl returned from the upload endpoint. Required for VIDEO, PDF, AUDIO, SLIDES types.',
  })
  @ValidateIf((o: CreateLectureDto) =>
    (
      [
        LectureContentType.VIDEO,
        LectureContentType.PDF,
        LectureContentType.AUDIO,
        LectureContentType.SLIDES,
      ] as const
    ).includes(o.content_type as never),
  )
  @IsUrl({}, { message: 'fileUrl must be a valid URL' })
  @IsNotEmpty()
  file_url?: string;

  // Required only for LINK type
  @ApiPropertyOptional({ example: 'https://www.youtube.com/watch?v=...' })
  @ValidateIf(
    (o: CreateLectureDto) => o.content_type === LectureContentType.LINK,
  )
  @IsUrl({}, { message: 'external_url must be a valid URL' })
  @IsNotEmpty()
  external_url?: string;

  // Required only for TEXT type
  @ApiPropertyOptional({
    description: 'Markdown text content — used when contentType is TEXT',
  })
  @ValidateIf(
    (o: CreateLectureDto) => o.content_type === LectureContentType.TEXT,
  )
  @IsString()
  @IsNotEmpty()
  text_content?: string;

  @ApiPropertyOptional({
    example: 45,
    description: 'Duration in minutes for video/audio',
  })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  duration_mins?: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Display order within the subject',
  })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  order?: number;
}

export class UpdateLectureDto {
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
  text_content?: string;

  @ApiPropertyOptional()
  @IsUrl()
  @IsOptional()
  external_url?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  duration_mins?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  order?: number;
}

// Client sends this to request a presigned upload URL
export class RequestUploadUrlDto {
  @ApiProperty({ example: 'introduction-to-algebra.mp4' })
  @IsString()
  @IsNotEmpty()
  file_name: string;

  @ApiProperty({ example: 'video/mp4' })
  @IsString()
  @IsNotEmpty()
  mime_type: string;

  @ApiProperty({ example: 10485760, description: 'File size in bytes' })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  file_size_bytes: number;
}

// Client sends this after successfully uploading to S3
export class ConfirmUploadDto {
  @ApiProperty({
    description: 'The fileKey returned from the presigned URL request',
  })
  @IsString()
  @IsNotEmpty()
  file_key: string;
}

// Student updates their view progress
export class UpdateViewProgressDto {
  @ApiProperty({ example: 75, description: 'Progress percentage 0-100' })
  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  progress_percentage: number;
}

export class QueryLecturesDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  subject_id?: string;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Class ID',
  })
  @IsString()
  @IsOptional()
  class_id?: string;

  @ApiPropertyOptional({ enum: LectureContentType })
  @IsEnum(LectureContentType)
  @IsOptional()
  content_type?: LectureContentType;
}

// Student queries lectures
export class QueryLecturesAsStudentDto {
  @ApiPropertyOptional({ description: 'Filter by subject ID' })
  @IsString()
  @IsOptional()
  subject_id?: string;

  @ApiPropertyOptional({ enum: LectureContentType })
  @IsEnum(LectureContentType)
  @IsOptional()
  content_type?: LectureContentType;
}
