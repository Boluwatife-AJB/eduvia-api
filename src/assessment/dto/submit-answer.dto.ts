import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class SubmitAnswerItemDto {
  @ApiProperty({ description: 'Question ID' })
  @IsString()
  @IsNotEmpty()
  question_id: string;

  @ApiPropertyOptional({
    description: 'For MCQ and TRUE_FALSE — the selected option ID',
    example: 'b',
  })
  @IsString()
  @IsOptional()
  selected_option_id?: string;

  @ApiPropertyOptional({
    description: 'For FILL_GAP, SHORT_ANSWER, ESSAY',
    example: 'Abuja',
  })
  @IsString()
  @IsOptional()
  text_answer?: string;
}

export class SubmitAnswersDto {
  @ApiProperty({ type: [SubmitAnswerItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerItemDto)
  answers: SubmitAnswerItemDto[];
}

export class AutoSaveDto {
  @ApiProperty({ type: [SubmitAnswerItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerItemDto)
  answers: SubmitAnswerItemDto[];
}
