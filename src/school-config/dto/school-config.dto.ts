import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { SchoolType } from 'src/generated/prisma/enums';

export class GradeScaleItemDto {
  @ApiProperty({ example: 'A' })
  @IsString()
  grade: string;

  @ApiProperty({ example: 90 })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsNotEmpty()
  min_score: number;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsNotEmpty()
  max_score: number;

  @ApiProperty({ example: 5.0 })
  @IsNumber()
  @Min(0)
  @Max(5)
  @IsNotEmpty()
  points: number;

  @ApiProperty({ example: 'Excellent' })
  @IsString()
  @IsNotEmpty()
  remark: string;
}

export class UpdateSchoolConfigDto {
  @ApiPropertyOptional({ enum: SchoolType })
  @IsEnum(SchoolType)
  @IsOptional()
  school_type?: SchoolType;

  @ApiPropertyOptional({
    example: 40,
    description: 'CA weight percentage. Must sum to 100 with exam weight.',
  })
  @IsInt()
  @IsOptional()
  ca_weight?: number;

  @ApiPropertyOptional({
    example: 60,
    description: 'Exam weight percentage. Must sum to 100 with ca weight.',
  })
  @IsInt()
  @IsOptional()
  exam_weight?: number;

  @ApiPropertyOptional({
    example: 4.0,
    description: 'GPA scale - either 4.0 or 5.0',
    enum: [4.0, 5.0],
  })
  @IsNumber()
  @IsOptional()
  gpa_scale?: number;

  @ApiPropertyOptional({ example: 40, description: 'Minimum score to pass. ' })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  pass_mark?: number;

  @ApiPropertyOptional({ type: [GradeScaleItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GradeScaleItemDto)
  @IsOptional()
  grading_scale?: GradeScaleItemDto[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  require_result_approval?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  require_exam_approval?: boolean;

  @ApiPropertyOptional({ example: 'School of Tyranus' })
  @IsString()
  @IsOptional()
  email_sender_name?: string;

  @ApiPropertyOptional({ example: 'NGN' })
  @IsString()
  @IsOptional()
  currency_code?: string;

  @ApiPropertyOptional({ example: '₦' })
  @IsString()
  @IsOptional()
  currency_symbol?: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  enable_late_fee?: boolean;

  @ApiPropertyOptional({ example: 5 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  late_fee_percent?: number;

  @ApiPropertyOptional({ example: 7 })
  @IsInt()
  @Min(0)
  @IsOptional()
  late_fee_grace_days?: number;
}
