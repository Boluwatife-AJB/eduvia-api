import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateClassDto {
  @ApiProperty({ example: 'JSS 1 Gold' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'JSS',
    description:
      'The school level this class belongs to e.g. JSS, SSS, Primary',
  })
  @IsString()
  @IsNotEmpty()
  level: string;

  @ApiPropertyOptional({
    example: 40,
    description: 'Maximum number of students',
  })
  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({
    description: 'Department ID (for SSS science/art classes)',
  })
  @IsString()
  @IsOptional()
  department_id?: string;

  @ApiPropertyOptional({
    description: 'User ID of the class teacher for this class',
  })
  @IsString()
  @IsOptional()
  class_teacher_id?: string;
}

export class UpdateClassDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  level?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  department_id?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  class_teacher_id?: string;
}
