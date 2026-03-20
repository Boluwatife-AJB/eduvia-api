import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class GetPresignedUrlDto {
  @ApiProperty({ example: 'lecture-intro-algebra.mp4' })
  @IsString()
  @IsNotEmpty()
  file_name: string;

  @ApiProperty({ example: 'video/mp4' })
  @IsString()
  @IsNotEmpty()
  mime_type: string;

  @ApiProperty({ example: 209715200, description: 'File size in bytes' })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  file_size_bytes: number;

  @ApiProperty({
    example: 'lectures',
    description: 'Folder in R2 to store the file under',
  })
  @IsString()
  @IsNotEmpty()
  folder: string;
}

export class ConfirmPresignedUploadDto {
  @ApiProperty({
    description: 'The fileKey returned from GET /upload/presigned-url',
  })
  @IsString()
  @IsNotEmpty()
  file_key: string;

  @ApiProperty({ example: 'lecture-intro-algebra.mp4' })
  @IsString()
  @IsNotEmpty()
  file_name: string;
}
