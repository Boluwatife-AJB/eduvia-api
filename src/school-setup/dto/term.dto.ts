import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateTermDto {
  @ApiProperty({ example: 'academic_session_id' })
  @IsString()
  @IsNotEmpty()
  academic_session_id: string;

  @ApiProperty({ example: 'First Term' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '18/09/2026' })
  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @ApiProperty({ example: '10/07/2027' })
  @IsDateString()
  @IsNotEmpty()
  end_date: string;

  @ApiPropertyOptional({
    description: 'Mark this as the currently active term',
  })
  @IsBoolean()
  @IsOptional()
  is_current?: boolean;
}

export class UpdateTermDto {
  @ApiPropertyOptional({
    example: 'First Term',
    description: 'The name of the term',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: '18/09/2026',
    description: 'The start date of the term',
  })
  @IsDateString()
  @IsOptional()
  start_date?: string;

  @ApiPropertyOptional({
    example: '10/07/2027',
    description: 'The end date of the term',
  })
  @IsDateString()
  @IsOptional()
  end_date?: string;

  @ApiPropertyOptional({
    description: 'Mark this as the currently active term',
  })
  @IsBoolean()
  @IsOptional()
  is_current?: boolean;
}
