import {
  DeleteObjectCommand,
  HeadObjectCommand,
  HeadObjectCommandOutput,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from 'src/errors/exceptions/app.exception';
import { ErrorCode } from 'src/errors/types/error-codes.enum';
import { v4 as uuidv4 } from 'uuid';

export interface UploadInstructions {
  method: 'PUT';
  url: string; // same as uploadUrl
  headers: Record<string, string>; // MUST be sent with the PUT request
  body_format: string; // 'raw-binary' — send the raw file bytes as body
  notes: string[];
}

export interface PresignedUploadResult {
  upload_url: string;
  file_key: string;
  public_url: string;
  expires_in: number;
  file_size_bytes: number;
  mime_type: string;
  upload_instructions: UploadInstructions;
}

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

export type AllowedMimeType =
  | 'video/mp4'
  | 'video/webm'
  | 'application/pdf'
  | 'audio/mpeg'
  | 'audio/mp3'
  | 'application/vnd.ms-powerpoint'
  | 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'text/csv';

// Max File Size per mime type in bytes
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

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly publicUrl: string;
  private readonly bucket: string;
  private readonly logger = new Logger(StorageService.name);

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
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });

    this.bucket = this.config.getOrThrow<string>('S3_BUCKET_NAME');
    this.publicUrl = this.config.getOrThrow<string>('S3_PUBLIC_URL');
  }

  // Validate MimeType
  validateMimeType(mimeType: string): void {
    if (!ACCEPTED_MIME_TYPES[mimeType]) {
      throw new AppException({
        code: ErrorCode.INVALID_CONTENT_TYPE,
        message: `File type '${mimeType}' is not accepted.`,
        statusCode: 400,
        action: `Please use a supported mime type. Allowed types are: ${Object.keys(ACCEPTED_MIME_TYPES).join(', ')}`,
      });
    }
  }

  // Validate File Size
  validateFileSize(mimeType: string, fileSizeBytes: number): void {
    const maxSize = MAX_FILE_SIZES[mimeType];
    if (!maxSize) return;

    if (fileSizeBytes > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024));
      const fileSizeMB = Math.round(fileSizeBytes / (1024 * 1024));

      throw new AppException({
        code: ErrorCode.FILE_TOO_LARGE,
        message: `File size '${fileSizeMB} MB' is too large for mime type '${mimeType}'. Maximum size is '${maxSizeMB} MB'.`,
        statusCode: 400,
        action: `Compress or split the file and try again.`,
      });
    }
  }

  // Generate a presigned upload URL for a file
  async generatePresignedUploadUrl(
    folder: string,
    tenantId: string,
    mimeType: AllowedMimeType,
    fileSizeBytes: number,
    fileName: string,
  ): Promise<PresignedUploadResult> {
    this.validateMimeType(mimeType);
    this.validateFileSize(mimeType, fileSizeBytes);

    const ext = ACCEPTED_MIME_TYPES[mimeType];
    const sanitized = fileName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .toLowerCase()
      .substring(0, 100);
    const fileKey = `${tenantId}/${folder}/${uuidv4()}_${sanitized}.${ext}`;
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
    const publicUrl = `${this.publicUrl}/${fileKey}`;

    this.logger.log(
      `Presigned URL generated: ${fileKey} (${mimeType}, ${Math.round(fileSizeBytes / 1024)}KB)`,
    );

    return {
      upload_url: uploadUrl,
      file_key: fileKey,
      public_url: publicUrl,
      expires_in: expiresIn,
      file_size_bytes: fileSizeBytes,
      mime_type: mimeType,
      upload_instructions: {
        method: 'PUT',
        url: uploadUrl,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': fileSizeBytes.toString(),
          'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
        },
        body_format: 'raw-binary',
        notes: [
          'Send the raw file bytes as the request body — not FormData or multipart.',
          'The Content-Type header must match exactly: ' + mimeType,
          'The Content-Length header must match exactly: ' + fileSizeBytes,
          `This URL expires in ${expiresIn / 60} minutes.`,
          'After a successful upload (HTTP 200 from R2), call the confirm endpoint.',
        ],
      },
    };
  }

  // Delete file from storage
  async deleteFile(fileKey: string): Promise<void> {
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: fileKey,
        }),
      );
      this.logger.log(`File deleted from storage: ${fileKey}`);
    } catch (error) {
      this.logger.error(`Error deleting file ${fileKey}: ${error}`);
      throw error;
    }
  }

  // Verify if file exists
  async verifyFileExists(
    fileKey: string,
  ): Promise<HeadObjectCommandOutput | null> {
    try {
      const response = await this.s3.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: fileKey,
        }),
      );
      return response;
    } catch (error) {
      this.logger.error(`Error verifying file ${fileKey}: ${error}`);
      return null;
    }
  }

  // Get actual file size from storage
  async getFileSizeFromStorage(fileKey: string): Promise<bigint> {
    const head = await this.verifyFileExists(fileKey);
    if (!head || !head.ContentLength) return BigInt(0);
    return BigInt(head.ContentLength);
  }

  // Get actual file mime type from storage
  async getFileMimeTypeFromStorage(fileKey: string): Promise<string> {
    const head = await this.verifyFileExists(fileKey);
    if (!head || !head.ContentType) return '';
    return head.ContentType ?? 'application/octet-stream';
  }

  // Converts a fileKey back to its public URL
  getPublicUrl(fileKey: string): string {
    return `${this.publicUrl}/${fileKey}`;
  }
}
