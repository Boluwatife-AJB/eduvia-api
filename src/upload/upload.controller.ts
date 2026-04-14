import {
  Body,
  Controller,
  HttpCode,
  Post,
  UploadedFile,
  UploadedFiles,
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
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ConfirmManyUploadsDto,
  ConfirmPresignedUploadDto,
  GetManyPresignedUrlsDto,
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

  // Bulk small file upload
  @Post('bulk')
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      // max 20 files per request
      storage: memoryStorage(),
      limits: { fileSize: LARGE_FILE_THRESHOLD },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
        folder: { type: 'string', example: 'repository' },
      },
    },
  })
  @ApiOperation({
    summary: 'Upload multiple files at once (each under 50MB)',
    description:
      'Send up to 20 files in one request. Returns success/failure per file. Partial success is valid — some files may succeed while others fail.',
  })
  async uploadManySmallFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('folder') folder: string,
  ) {
    const tenantId = this.cls.get<string>('tenantId');
    return this.uploadService.uploadManySmallFiles(
      files,
      folder ?? 'general',
      tenantId,
    );
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

  //  Bulk presigned url
  @Post('presigned-url/bulk')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get presigned URLs for multiple large files at once',
    description:
      'Step 1 of 2 for bulk large file uploads. Returns an uploadUrl per file. PUT each file to its uploadUrl in parallel, then call /upload/confirm/bulk.',
  })
  getManyPresignedUrls(@Body() dto: GetManyPresignedUrlsDto) {
    const tenantId = this.cls.get<string>('tenantId');
    return this.uploadService.getManyPresignedUrls(
      dto.files,
      dto.folder,
      tenantId,
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

  // Bulk confirm large file uploads@Post('confirm/bulk')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Confirm multiple large file uploads at once — step 2 of 2',
    description:
      'Call after all PUT requests to R2 have completed. Returns fileUrl per file to use in your create requests.',
  })
  confirmManyPresignedUploads(@Body() dto: ConfirmManyUploadsDto) {
    return this.uploadService.confirmManyPresignedUploads(dto.uploads);
  }
}
