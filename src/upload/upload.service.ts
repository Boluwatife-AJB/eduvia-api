import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from 'src/errors/exceptions/app.exception';
import { ErrorCode } from 'src/errors/types/error-codes.enum';
import { v4 as uuidv4 } from 'uuid';

export const ACCEPTED_MIME_TYPES: Record<string, string> = {
  // Video
  'video/mp4': 'mp4',
  'video/webm': 'webm',

  // Audio
  'audio/mpeg': 'mp3',
  'audio/mp4': 'mp4',
  'audio/ogg': 'ogg',

  // Documents
  'application/pdf': 'pdf',

  // Presentations
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'pptx',

  // Spreadsheets
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',

  // Word documents
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',

  // Images
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',

  // Data
  'text/csv': 'csv',
  'application/json': 'json',
};

export const MAX_FILE_SIZES: Record<string, number> = {
  'video/mp4': 10 * 1024 * 1024, // 10MB
  'video/webm': 10 * 1024 * 1024, // 10MB
  'application/pdf': 10 * 1024 * 1024, // 10MB
  'audio/mpeg': 10 * 1024 * 1024, // 10MB
  'audio/mp3': 10 * 1024 * 1024, // 10MB
  'application/vnd.ms-powerpoint': 10 * 1024 * 1024, // 10MB
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    10 * 1024 * 1024, // 10MB
  'image/jpeg': 10 * 1024 * 1024, // 10MB
  'image/png': 10 * 1024 * 1024, // 10MB
  'image/webp': 10 * 1024 * 1024, // 10MB
  'text/csv': 10 * 1024 * 1024, // 10MB
};

// Files above this threshold will use presigned URL flow
// Files below this threshold will use direct upload flow
export const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024;

export interface UploadResult {
  file_url: string;
  file_key: string;
  mime_type: string;
  file_size_bytes: number;
  file_name: string;
}

export interface PresignedUrlResult {
  strategy: 'presigned';
  upload_url: string;
  file_key: string;
  public_url: string;
  expires_in: number;
  mime_type: string;
  file_name: string;
  required_headers: {
    'Content-Type': string;
    'x-amz-content-sha256': string;
  };
}

export interface BulkUploadResultItem {
  file_name: string;
  status: 'success' | 'failed';
  file_url?: string;
  file_key?: string;
  mime_type?: string;
  file_size_bytes?: number;
  error?: string;
}

export interface BulkUploadResult {
  total: number;
  succeeded: number;
  failed: number;
  files: BulkUploadResultItem[];
}

export interface BulkPresignedUrlResultItem {
  file_name: string;
  status: 'ready' | 'failed';
  upload_url?: string;
  file_key?: string;
  public_url?: string;
  required_headers?: {
    'Content-Type': string;
    'x-amz-content-sha256': string;
  };
  error?: string;
}

export interface BulkPresignedUrlResult {
  total: number;
  ready: number;
  failed: number;
  files: BulkPresignedUrlResultItem[];
}

@Injectable()
export class UploadService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly logger = new Logger(UploadService.name);

  constructor(private readonly config: ConfigService) {
    const region = this.config.getOrThrow<string>('S3_REGION');
    const endpoint = this.config.getOrThrow<string>('S3_ENDPOINT');
    const accessKeyId = this.config.getOrThrow<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.getOrThrow<string>(
      'S3_SECRET_ACCESS_KEY',
    );

    this.s3 = new S3Client({
      region,
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.bucket = this.config.getOrThrow<string>('S3_BUCKET_NAME');
    this.publicUrl = this.config.getOrThrow<string>('S3_PUBLIC_URL');
  }

  // Part A: Upload small files (< 50MB)
  async uploadSmallFile(
    file: Express.Multer.File,
    folder: string,
    tenantId: string,
  ): Promise<UploadResult> {
    this.validateFileSize(file.mimetype, file.size);
    this.validateMimeType(file.mimetype);

    const originalName = file.originalname ?? file.filename ?? 'upload';

    const fileKey = this.buildFileKey(
      tenantId,
      folder,
      file.mimetype,
      originalName,
    );

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    this.logger.log(
      `File uploaded: ${fileKey} (${file.mimetype}, ${file.size} bytes)`,
    );

    return {
      file_url: `${this.publicUrl}/${fileKey}`,
      file_key: fileKey,
      mime_type: file.mimetype,
      file_size_bytes: file.size,
      file_name: originalName,
    };
  }

  async uploadManySmallFiles(
    files: Express.Multer.File[],
    folder: string,
    tenantId: string,
  ): Promise<BulkUploadResult> {
    const results: BulkUploadResultItem[] = [];

    const settled = await Promise.allSettled(
      files.map((file) => this.uploadSmallFile(file, folder, tenantId)),
    );

    for (let i = 0; i < settled.length; i++) {
      const file = files[i];
      const result = settled[i];

      if (result.status === 'fulfilled') {
        results.push({
          file_name: file.originalname,
          status: 'success',
          file_url: result.value.file_url,
          file_key: result.value.file_key,
          mime_type: result.value.mime_type,
          file_size_bytes: result.value.file_size_bytes,
        });
      } else {
        results.push({
          file_name: file.originalname,
          status: 'failed',
          error: (result.reason as Error)?.message ?? 'Upload failed',
        });
      }
    }

    const succeeded = results.filter(
      (result) => result.status === 'success',
    ).length;
    const failed = results.filter(
      (result) => result.status === 'failed',
    ).length;

    this.logger.log(
      `Bulk upload: ${succeeded} files uploaded successfully, ${failed} files failed in this school ${tenantId}`,
    );

    return {
      total: files.length,
      succeeded: succeeded,
      failed: failed,
      files: results,
    };
  }

  // Part B: Upload large files (> 50MB)
  async getPresignedUrl(
    folder: string,
    tenantId: string,
    mimeType: string,
    fileSizeBytes: number,
    fileName: string,
  ): Promise<PresignedUrlResult> {
    this.validateMimeType(mimeType);
    this.validateFileSize(mimeType, fileSizeBytes);

    const fileKey = this.buildFileKey(tenantId, folder, mimeType, fileName);
    const expiresIn = 15 * 60; // 15 minutes to upload

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
      ContentType: mimeType,
      ContentLength: fileSizeBytes,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn,
      unhoistableHeaders: new Set(['x-amz-content-sha256']),
    });

    return {
      strategy: 'presigned',
      upload_url: uploadUrl,
      file_key: fileKey,
      public_url: `${this.publicUrl}/${fileKey}`,
      file_name: fileName,
      mime_type: mimeType,
      expires_in: expiresIn,
      required_headers: {
        'Content-Type': mimeType,
        'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
      },
    };
  }

  async getManyPresignedUrls(
    files: Array<{
      file_name: string;
      mime_type: string;
      file_size_bytes: number;
    }>,
    folder: string,
    tenantId: string,
  ): Promise<BulkPresignedUrlResult> {
    const results: BulkPresignedUrlResultItem[] = [];

    const settled = await Promise.allSettled(
      files.map((file) =>
        this.getPresignedUrl(
          folder,
          tenantId,
          file.mime_type,
          file.file_size_bytes,
          file.file_name,
        ),
      ),
    );

    for (let i = 0; i < settled.length; i++) {
      const file = files[i];
      const result = settled[i];

      if (result.status === 'fulfilled') {
        results.push({
          file_name: file.file_name,
          status: 'ready',
          upload_url: result.value.upload_url,
          file_key: result.value.file_key,
          public_url: result.value.public_url,
          required_headers: result.value.required_headers,
        });
      } else {
        results.push({
          file_name: file.file_name,
          status: 'failed',
          error:
            (result.reason as Error)?.message ??
            'Could not generate upload URL',
        });
      }
    }

    const ready = results.filter((result) => result.status === 'ready').length;
    const failed = results.filter(
      (result) => result.status === 'failed',
    ).length;

    return {
      total: files.length,
      ready: ready,
      failed: failed,
      files: results,
    };
  }

  // Confirm presigned upload
  async confirmPresignedUpload(
    fileKey: string,
    fileName: string,
  ): Promise<UploadResult> {
    const head = await this.s3
      .send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: fileKey,
        }),
      )
      .catch(() => null);

    if (!head) {
      throw new AppException({
        code: ErrorCode.FILE_NOT_FOUND_IN_STORAGE,
        statusCode: 404,
        message:
          'File not found in storage. The upload may have failed or the URL expired.',
        action: 'Re-upload the file and try again.',
      });
    }

    return {
      file_url: `${this.publicUrl}/${fileKey}`,
      file_key: fileKey,
      mime_type: head.ContentType ?? 'application/octet-stream',
      file_size_bytes: head.ContentLength ?? 0,
      file_name: fileName,
    };
  }

  async confirmManyPresignedUploads(
    uploads: Array<{ file_key: string; file_name: string }>,
  ): Promise<BulkUploadResult> {
    const settled = await Promise.allSettled(
      uploads.map((upload) =>
        this.confirmPresignedUpload(upload.file_key, upload.file_name),
      ),
    );

    const results: BulkUploadResultItem[] = [];

    for (let i = 0; i < settled.length; i++) {
      const upload = uploads[i];
      const result = settled[i];

      if (result.status === 'fulfilled') {
        results.push({
          file_name: upload.file_name,
          status: 'success',
          file_url: result.value.file_url,
          file_key: result.value.file_key,
          mime_type: result.value.mime_type,
          file_size_bytes: result.value.file_size_bytes,
        });
      } else {
        results.push({
          file_name: upload.file_name,
          status: 'failed',
          error: (result.reason as Error)?.message ?? 'Confirmation failed',
        });
      }
    }

    const succeeded = results.filter(
      (result) => result.status === 'success',
    ).length;
    const failed = results.filter(
      (result) => result.status === 'failed',
    ).length;

    this.logger.log(
      `Bulk confirmation: ${succeeded} uploads confirmed successfully, ${failed} uploads failed`,
    );

    return {
      total: uploads.length,
      succeeded: succeeded,
      failed: failed,
      files: results,
    };
  }

  // Delete file
  async deleteFile(fileKey: string): Promise<void> {
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: fileKey,
        }),
      );
    } catch (error) {
      this.logger.error(`Error deleting file ${fileKey}: ${error}`);
      throw error;
    }
  }

  // Verify file exists in R2
  async verifyFileInStorage(fileKey: string) {
    try {
      const result = await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: fileKey }),
      );
      return result; // { ContentLength, ContentType, ... }
    } catch {
      return null;
    }
  }

  // Private Helper Methods
  private validateMimeType(mimeType: string): void {
    if (!ACCEPTED_MIME_TYPES[mimeType]) {
      throw new AppException({
        code: ErrorCode.INVALID_CONTENT_TYPE,
        statusCode: 400,
        message: `File type '${mimeType}' is not accepted.`,
        action: `Accepted types: ${Object.keys(ACCEPTED_MIME_TYPES).join(', ')}`,
      });
    }
  }

  private validateFileSize(mimeType: string, fileSizeBytes: number): void {
    const maxSize = MAX_FILE_SIZES[mimeType];
    if (maxSize && fileSizeBytes > maxSize) {
      const maxMB = Math.round(maxSize / (1024 * 1024));
      const fileMB = Math.round(fileSizeBytes / (1024 * 1024));
      throw new AppException({
        code: ErrorCode.FILE_TOO_LARGE,
        statusCode: 400,
        message: `File is too large. You submitted ${fileMB}MB but the limit for this file type is ${maxMB}MB.`,
      });
    }
  }

  private buildFileKey(
    tenantId: string,
    folder: string,
    mimeType: string,
    originalName: string,
  ): string {
    const ext = ACCEPTED_MIME_TYPES[mimeType];
    const sanitised = (originalName || 'file')
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .toLowerCase()
      .substring(0, 80);
    return `${tenantId}/${folder}/${uuidv4()}-${sanitised}.${ext}`;
  }
}
