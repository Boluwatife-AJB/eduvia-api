import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

// This DTO is used to reset the password of a user by an admin
export class AdminResetPasswordDto {
  @ApiProperty({ minLength: 8 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  new_password: string;
}
