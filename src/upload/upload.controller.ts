import {
  Body,
  Controller,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LARGE_FILE_THRESHOLD, UploadService } from './upload.service';
import { ClsService } from 'nestjs-cls';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ConfirmPresignedUploadDto,
  GetPresignedUrlDto,
} from './dto/upload.dto';

@ApiTags('Upload')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly cls: ClsService,
  ) {}

  // Small file upload
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: LARGE_FILE_THRESHOLD,
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        folder: { type: 'string', example: 'lectures' },
      },
    },
  })
  // @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Upload a file (< 50MB) — returns fileUrl to use in create requests',
    description:
      'Use this for PDFs, images, audio, documents. Returns a fileUrl you attach directly to the create lecture / create repository file request body.',
  })
  @ApiResponse({
    status: 200,
    description: 'File uploaded successfully',
  })
  async uploadSmallFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder: string,
  ) {
    const tenantId = this.cls.get<string>('tenantId');
    const result = await this.uploadService.uploadSmallFile(
      file,
      folder ?? 'general',
      tenantId,
    );
    return {
      strategy: 'direct',
      ...result,
    };
  }

  // Step 1: Large file upload
  @Post('presigned-url')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get a presigned URL to upload a file (> 50MB)',
    description:
      'Step 1 of 2 for large files. Get this URL, PUT the file directly to R2, then call /upload/confirm.',
  })
  @ApiResponse({
    status: 200,
    description: 'Presigned URL generated successfully',
  })
  async getPresignedUrl(@Body() dto: GetPresignedUrlDto) {
    const tenantId = this.cls.get<string>('tenantId');
    return this.uploadService.getPresignedUrl(
      dto.folder,
      tenantId,
      dto.mime_type,
      dto.file_size_bytes,
      dto.file_name,
    );
  }

  // Step 2: Confirm large file upload
  @Post('confirm')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Confirm a large file upload',
    description:
      'Step 2 of 2 for large files. Confirm the upload by calling this endpoint with the fileKey returned from the presigned URL.',
  })
  @ApiResponse({
    status: 200,
    description: 'File uploaded successfully',
  })
  async confirmPresignedUpload(@Body() dto: ConfirmPresignedUploadDto) {
    return this.uploadService.confirmPresignedUpload(
      dto.file_key,
      dto.file_name,
    );
  }
}
