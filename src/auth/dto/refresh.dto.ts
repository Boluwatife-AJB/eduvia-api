import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshDto {
  @ApiProperty({ description: 'The refresh token received at login' })
  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}
