import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Sciences' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 'Science department covering Biology, Chemistry, Physics',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: 'hod-id',
    description: 'The USER_ID of the head of department',
  })
  @IsString()
  @IsOptional()
  hod_id?: string;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional({
    example: 'Sciences',
    description: 'The name of the department',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: 'Science department covering Biology, Chemistry, Physics',
    description: 'The description of the department',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: 'hod-id',
    description: 'The USER_ID of the head of department',
  })
  @IsString()
  @IsOptional()
  hod_id?: string;
}
