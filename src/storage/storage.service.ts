import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

export interface PresignedUploadResult {
  uploadUrl: string;
  fieldKey: string;
  publicUrl: string;
  expiresIn: number;
}

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

// Max File Size in bytes
const MAX_SIZES: Record<AllowedMimeType, number> = {
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
    });

    this.bucket = this.config.getOrThrow<string>('S3_BUCKET_NAME');
    this.publicUrl = this.config.getOrThrow<string>('S3_PUBLIC_URL');
  }

  // Generate a presigned upload URL for a file
  async generatePresignedUploadUrl(
    folder: string,
    tenantId: string,
    mimeType: AllowedMimeType,
    fileSizeBytes: number,
    fileName: string,
  ): Promise<PresignedUploadResult> {
    const maxSize = MAX_SIZES[mimeType];
    if (maxSize && fileSizeBytes > maxSize) {
      throw new Error(
        `File too large. Maximum size for ${mimeType} is ${maxSize / (1024 * 1024)} MB.`,
      );
    }

    // Sanitize the original filename and make it unique
    const sanitized = fileName.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
    const fileKey = `${tenantId}/${folder}/${uuidv4()}_${sanitized}`;
    const expiresIn = 15 * 60; // 15 minutes to upload

    // Generate a presigned upload URL
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
      ContentType: mimeType,
      ContentLength: fileSizeBytes,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn });

    return {
      uploadUrl,
      fieldKey: fileKey,
      publicUrl: `${this.publicUrl}/${fileKey}`,
      expiresIn,
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
    } catch (error) {
      this.logger.error(`Error deleting file ${fileKey}: ${error}`);
      throw error;
    }
  }

  // Verify if file exists
  async verifyFileExists(fileKey: string): Promise<boolean> {
    try {
      await this.s3.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: fileKey,
        }),
      );
      return true;
    } catch (error) {
      this.logger.error(`Error verifying file ${fileKey}: ${error}`);
      return false;
    }
  }

  // Converts a fileKey back to its public URL
  getPublicUrl(fileKey: string): string {
    return `${this.publicUrl}/${fileKey}`;
  }
}
