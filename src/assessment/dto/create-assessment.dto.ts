import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  AssessmentType,
  CAComponent,
  QuestionType,
} from 'src/generated/prisma/enums';

export class CreateQuestionDto {
  @ApiProperty({ enum: QuestionType })
  @IsEnum(QuestionType)
  @IsNotEmpty()
  type: QuestionType;

  @ApiProperty({ example: 'What is the capital of Nigeria?' })
  @IsString()
  @IsNotEmpty()
  question_text: string;

  @ApiPropertyOptional({
    description: 'URL of an image to show with the question',
  })
  @IsUrl()
  @IsOptional()
  question_image?: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  marks: number;

  @ApiPropertyOptional({
    description:
      'Required for multiple choice and true/false questions. Array of options objects',
    example: [
      { id: 'a', text: 'Abuja', is_correct: true },
      { id: 'b', text: 'Lagos', is_correct: false },
      { id: 'c', text: 'Kano', is_correct: false },
      { id: 'd', text: 'Port Harcourt', is_correct: false },
    ],
  })
  @IsArray()
  @IsOptional()
  options?: { id: string; text: string; is_correct: boolean }[];

  @ApiProperty({
    example: 'Abuja',
    description:
      'Required for fill in the blank questions. The correct answer to the question',
  })
  @IsString()
  @IsNotEmpty()
  correct_answer: string;

  @ApiPropertyOptional({
    description:
      'Required for fill in the blank questions. Array of accepted answers to the question',
    example: ['Abuja', 'abuja', 'aBuja'],
  })
  @IsArray()
  @IsOptional()
  accepted_answers?: string[];

  @ApiPropertyOptional({
    description:
      'For Essay and Short Answer, displayed to the teacher during grading',
  })
  @IsString()
  @IsOptional()
  marking_guide?: string;

  @ApiPropertyOptional({ example: 500 })
  @IsInt()
  @Min(0)
  @IsOptional()
  max_word_count?: number;
}

export class CreateAssessmentDto {
  @ApiProperty({ example: 'First Term Mathematics Examination' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    example: 'Answer all questions. Time allowed: 2 hours.',
  })
  @IsString()
  @IsOptional()
  instructions?: string;

  @ApiProperty({ enum: AssessmentType })
  @IsEnum(AssessmentType)
  type: AssessmentType;

  @ApiProperty({ description: 'Class ID' })
  @IsString()
  @IsNotEmpty()
  class_id: string;

  @ApiProperty({ description: 'Subject ID' })
  @IsString()
  @IsNotEmpty()
  subject_id: string;

  @ApiProperty({ description: 'Teacher ID' })
  @IsString()
  @IsNotEmpty()
  teacher_id: string;

  @ApiPropertyOptional({
    description: 'Term ID — defaults to current term if not provided',
  })
  @IsString()
  @IsOptional()
  termId?: string;

  @ApiPropertyOptional({ example: '2025-06-10T09:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  start_time?: string;

  @ApiPropertyOptional({ example: '2025-06-10T11:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  end_time?: string;

  @ApiPropertyOptional({
    example: 120,
    description: 'Duration in minutes. null means untimed.',
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  duration_mins?: number;

  @ApiPropertyOptional({ example: 60 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  pass_mark?: number;

  @ApiPropertyOptional({
    description: 'Is this assessment part of the CA score?',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  is_exam_component?: boolean;

  @ApiPropertyOptional({
    enum: ['CA1', 'CA2', 'CA3', 'CA4', 'CA5'],
    description:
      'Which CA slot this fills — required when isExamComponent is true',
  })
  @IsEnum(CAComponent)
  @IsOptional()
  ca_component?: CAComponent;

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  max_attempts?: number;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  shuffle_questions?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  shuffle_options?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  prevent_tab_switch?: boolean;

  @ApiProperty({
    type: [CreateQuestionDto],
    description: 'Array of questions for this assessment',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions: CreateQuestionDto[];
}

export class UpdateAssessmentDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  instructions?: string;

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
  @IsOptional()
  duration_mins?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  shuffle_questions?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  shuffle_options?: boolean;
}
