import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'GFA/2026/001',
    description: 'Student matric number, teacher ID, guardian ID, etc.',
  })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({ example: 'password123', description: "User's password" })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
