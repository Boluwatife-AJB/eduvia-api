import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'old-password' })
  @IsString()
  @IsNotEmpty()
  current_password: string;

  @ApiProperty({ example: 'new-password', minLength: 8 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  new_password: string;
}
