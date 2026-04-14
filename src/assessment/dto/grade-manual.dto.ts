import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class GradeAnswerItemDto {
  @ApiProperty({ description: 'SubmissionAnswer ID' })
  @IsString()
  @IsNotEmpty()
  answer_id: string;

  @ApiProperty({ example: 8 })
  @IsNumber()
  @Min(0)
  marks_awarded: number;

  @ApiPropertyOptional({ example: 'Good analysis but missing the conclusion.' })
  @IsString()
  @IsOptional()
  comment?: string;
}

export class GradeManualAnswersDto {
  @ApiProperty({ type: [GradeAnswerItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => GradeAnswerItemDto)
  grades: GradeAnswerItemDto[];

  @ApiPropertyOptional({ description: 'Overall feedback for the student' })
  @IsString()
  @IsOptional()
  feedback?: string;
}
