import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSubjectDto {
  @ApiProperty({ example: 'Introduction to Financial Accounting' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Accounting' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'ACC 101' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({
    example: 'Covers basic principles of financial accounting',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Department this subject belongs to' })
  @IsString()
  @IsOptional()
  department_id?: string;
}

export class UpdateSubjectDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  // @ApiPropertyOptional()
  // @IsString()
  // @IsOptional()
  // code?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  // @ApiPropertyOptional()
  // @IsString()
  // @IsOptional()
  // department_id?: string;
}
