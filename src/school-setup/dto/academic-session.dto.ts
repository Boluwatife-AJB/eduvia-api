import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAcademicSessionDto {
  @ApiProperty({ example: '2026/2027' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '2026-09-01' })
  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @ApiProperty({ example: '2027-07-31' })
  @IsDateString()
  @IsNotEmpty()
  end_date: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Mark this as the current active session',
  })
  @IsBoolean()
  @IsOptional()
  is_current?: boolean;
}

export class UpdateAcademicSessionDto {
  @ApiPropertyOptional({
    example: '2026/2027',
    description: 'The name of the academic session',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: '18/09/2026',
    description: 'The start date of the academic session',
  })
  @IsDateString()
  @IsOptional()
  start_date?: string;

  @ApiPropertyOptional({
    example: '2027-07-31',
    description: 'The end date of the academic session',
  })
  @IsDateString()
  @IsOptional()
  end_date?: string;
}
