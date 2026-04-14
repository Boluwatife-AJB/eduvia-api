import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from 'src/database/prisma.service';
import { AppException } from 'src/errors/exceptions/app.exception';
import {
  FileArchivedException,
  FileUnderRetentionException,
  FileVersionNotFoundException,
  RepositoryFileNotFoundException,
  ShareLinkExpiredException,
  ShareLinkMaxAccessException,
  ShareLinkNotAllowedException,
  ShareLinkNotFoundException,
} from 'src/errors/exceptions/business.exception';
import { ErrorCode } from 'src/errors/types/error-codes.enum';
import {
  FileStatus,
  RepositoryScope,
  UserRole,
} from 'src/generated/prisma/enums';
import { UploadService } from 'src/upload/upload.service';
import { v4 as uuidv4 } from 'uuid';
import {
  AddNewVersionDto,
  CreateRepositoryFileDto,
  GenerateShareLinkDto,
  ListFilesDto,
  UpdateFileMetaDto,
} from './dto/file.dto';
import { RepositoryAccessService } from './repository-access.service';
import { RepositoryQuotaService } from './repository-quota.service';

// Scopes that do not support share links e.g health records, counseling records, staff salary, etc.
const NO_SHARE_LINK_SCOPES: RepositoryScope[] = [
  RepositoryScope.HEALTH_RECORDS,
  RepositoryScope.COUNSELING_RECORDS,
  RepositoryScope.STAFF_SALARY,
];

// Scopes that support audit view e.g health records, counseling records
const AUDIT_VIEW_SCOPES: RepositoryScope[] = [
  RepositoryScope.HEALTH_RECORDS,
  RepositoryScope.COUNSELING_RECORDS,
  RepositoryScope.STAFF_SALARY,
  RepositoryScope.TUITION_PAYMENTS,
  RepositoryScope.STAFF_RECORDS,
  RepositoryScope.DISCIPLINARY_RECORDS,
  RepositoryScope.SCHOOL_EXPENSES,
];

// Scopes that support retention policy (30 days)
const RETENTION_SCOPES: RepositoryScope[] = [
  RepositoryScope.TUITION_PAYMENTS,
  RepositoryScope.STAFF_SALARY,
  RepositoryScope.SCHOOL_EXPENSES,
];

@Injectable()
export class RepositoryFileService {
  private readonly logger = new Logger(RepositoryFileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly upload: UploadService,
    private readonly quota: RepositoryQuotaService,
    private readonly access: RepositoryAccessService,
    private readonly cls: ClsService,
  ) {}

  // Create file record
  async createFileRecord(
    dto: CreateRepositoryFileDto,
    user: { id: string; role: UserRole },
  ) {
    const tenantId = this.cls.get<string>('tenantId');

    await this.access.assertAccess({
      userId: user.id,
      userRole: user.role,
      tenantId,
      scope: dto.scope,
      scopeId: dto.scope_id,
      action: 'UPLOAD',
    });

    // Verify file exists in R2 before creating db record
    const head = await this.upload.verifyFileInStorage(dto.file_key);
    if (!head) {
      throw new AppException({
        code: ErrorCode.FILE_NOT_FOUND_IN_STORAGE,
        statusCode: 400,
        message:
          'File not found in storage. The upload may have failed or the URL expired.',
        action:
          'Upload the file first via POST /upload, then create the record.',
      });
    }

    // Verify file size matches
    const fileSizeBytes = BigInt(head.ContentLength ?? 0);
    const mimeType = head.ContentType ?? 'application/octet-stream';

    // Check quota with the real file size
    await this.quota.assertUploadAllowed(tenantId, fileSizeBytes);

    // Calculate retention period for financial records
    let retentionUntil: Date | null = null;
    if (RETENTION_SCOPES.includes(dto.scope)) {
      retentionUntil = new Date();
      retentionUntil.setDate(retentionUntil.getDate() + 30);
    }

    const file = await this.prisma.$transaction(async (tx) => {
      const newFile = await tx.repositoryFile.create({
        data: {
          tenant_id: tenantId,
          folder_id: dto.folder_id ?? '',
          scope: dto.scope,
          scope_id: dto.scope_id ?? null,
          name: dto.name,
          description: dto.description ?? null,
          tags: dto.tags ?? [],
          total_versions: 1,
          status: FileStatus.ACTIVE,
          is_global_search: dto.scope === RepositoryScope.PAST_QUESTIONS,
          expires_at: dto.expires_at ? new Date(dto.expires_at) : null,
          retention_until: retentionUntil,
          uploaded_by: user.id,
          link_record_type: dto.linked_record_type ?? null,
          link_record_id: dto.linked_record_id ?? null,
        },
      });

      // Create the first version with metadata from R2
      const version = await tx.repositoryFileVersion.create({
        data: {
          file_id: newFile.id,
          tenant_id: tenantId,
          version_number: 1,
          file_key: dto.file_key,
          file_url: dto.file_url,
          mime_type: mimeType,
          file_size_bytes: fileSizeBytes,
          uploaded_by: user.id,
          change_note: dto.change_note ?? 'Initial upload',
        },
      });

      // Point the file record at its current version
      await tx.repositoryFile.update({
        where: { id: newFile.id },
        data: { current_version_id: version.id },
      });

      return newFile;
    });

    // Update the school's storage quota usage
    await this.quota.incrementUsage(tenantId, fileSizeBytes);

    this.logger.log(
      `Repository file '${dto.name}' created in scope '${dto.scope}' by '${user.id}' in tenant '${tenantId}'`,
    );

    return this.findOne(file.id, user);
  }

  // Add new version
  async addNewVersion(
    fileId: string,
    dto: AddNewVersionDto,
    user: { id: string; role: UserRole },
  ) {
    const tenantId = this.cls.get<string>('tenantId');
    const file = await this.findOne(fileId, user);

    // Confirm upload permission for this scope
    await this.access.assertAccess({
      userId: user.id,
      userRole: user.role,
      tenantId,
      scope: file.scope,
      scopeId: file.scope_id ?? undefined,
      action: 'UPLOAD',
    });

    // Verify file exists in R2
    const head = await this.upload.verifyFileInStorage(dto.file_key);
    if (!head) {
      throw new AppException({
        code: ErrorCode.FILE_NOT_FOUND_IN_STORAGE,
        statusCode: 400,
        message:
          'File not found in storage. The upload may have failed or the URL expired.',
        action: 'Upload the file first via POST /upload, then add the version.',
      });
    }

    const fileSizeBytes = BigInt(head.ContentLength ?? 0);
    const mimeType = head.ContentType ?? 'application/octet-stream';
    const nextVersion = file.total_versions + 1;

    await this.quota.assertUploadAllowed(tenantId, fileSizeBytes);

    await this.prisma.$transaction(async (tx) => {
      const version = await tx.repositoryFileVersion.create({
        data: {
          file_id: file.id,
          tenant_id: tenantId,
          version_number: nextVersion,
          file_key: dto.file_key,
          file_url: dto.file_url,
          mime_type: mimeType,
          file_size_bytes: fileSizeBytes,
          uploaded_by: user.id,
          change_note: dto.change_note ?? null,
        },
      });

      await tx.repositoryFile.update({
        where: { id: file.id },
        data: { total_versions: nextVersion, current_version_id: version.id },
      });
    });

    await this.quota.incrementUsage(tenantId, fileSizeBytes);

    return this.findOne(file.id, user);
  }

  // List all files
  async findAll(dto: ListFilesDto, user: { id: string; role: UserRole }) {
    const tenantId = this.cls.get<string>('tenantId');

    const files = await this.prisma.repositoryFile.findMany({
      where: {
        tenant_id: tenantId,
        status: FileStatus.ACTIVE,
        ...(dto.scope && { scope: dto.scope }),
        ...(dto.scope_id && { scope_id: dto.scope_id }),
        ...(dto.folder_id && { folder_id: dto.folder_id }),
        ...(dto.search && {
          OR: [
            { name: { contains: dto.search, mode: 'insensitive' } },
            { description: { contains: dto.search, mode: 'insensitive' } },
            { tags: { hasSome: dto.search.split(' ') } },
          ],
        }),
      },
      include: {
        versions: { orderBy: { version_number: 'desc' }, take: 1 },
        folder: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    // Filter out files that are not accessible to the user
    const accessibleFiles = await Promise.all(
      files.map(async (file) => {
        const canAccess = await this.access.canAccess({
          userId: user.id,
          userRole: user.role,
          tenantId,
          scope: file.scope,
          scopeId: file.scope_id ?? undefined,
          action: 'VIEW',
        });

        return canAccess ? file : null;
      }),
    );

    return accessibleFiles.filter((file) => file !== null);
  }

  // Get one file
  async findOne(
    fileId: string,
    user: { id: string; role: UserRole },
    req?: Request,
  ) {
    const tenantId = this.cls.get<string>('tenantId');

    const file = await this.prisma.repositoryFile.findFirst({
      where: { id: fileId, tenant_id: tenantId },
      include: {
        versions: { orderBy: { version_number: 'desc' }, take: 1 },
        folder: { select: { id: true, name: true } },
      },
    });

    if (!file) throw new RepositoryFileNotFoundException();
    if (file.status === FileStatus.ARCHIVED) throw new FileArchivedException();

    await this.access.assertAccess({
      userId: user.id,
      userRole: user.role,
      tenantId,
      scope: file.scope,
      scopeId: file.scope_id ?? undefined,
      action: 'VIEW',
    });

    // Log access for sensitive scopes
    if (AUDIT_VIEW_SCOPES.includes(file.scope)) {
      await this.logAccess(file.id, tenantId, user.id, 'VIEW', req);
    }

    return file;
  }

  // Get version history
  async getVersionHistory(
    fileId: string,
    user: { id: string; role: UserRole },
  ) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.findOne(fileId, user);

    return this.prisma.repositoryFileVersion.findMany({
      where: { file_id: fileId, tenant_id: tenantId },
      orderBy: { version_number: 'desc' },
    });
  }

  // Delete a specific old version
  async deleteVersion(
    fileId: string,
    versionId: string,
    user: { id: string; role: UserRole },
  ) {
    const tenantId = this.cls.get<string>('tenantId');
    const file = await this.findOne(fileId, user);

    if (file.current_version_id === versionId) {
      throw new AppException({
        code: ErrorCode.INVALID_INPUT,
        statusCode: 400,
        message:
          'Cannot delete the current version. Delete the entire file instead.',
      });
    }

    const version = await this.prisma.repositoryFileVersion.findFirst({
      where: { id: versionId, file_id: fileId },
    });

    if (!version) throw new FileVersionNotFoundException();

    // Delete the actual version from R2
    await this.upload.deleteFile(version.file_key);

    await this.prisma.repositoryFileVersion.delete({
      where: { id: versionId, tenant_id: tenantId },
    });

    return this.prisma.repositoryFileVersion.delete({
      where: { id: versionId },
    });
  }

  // Update Metadata
  async updateMetadata(
    fileId: string,
    dto: UpdateFileMetaDto,
    user: { id: string; role: UserRole },
  ) {
    await this.findOne(fileId, user);

    return this.prisma.repositoryFile.update({
      where: { id: fileId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.expires_at !== undefined && {
          expires_at: new Date(dto.expires_at),
        }),
      },
    });
  }

  // Soft delete (Archive)
  async softDelete(fileId: string, user: { id: string; role: UserRole }) {
    const tenantId = this.cls.get<string>('tenantId');
    const file = await this.findOne(fileId, user);

    await this.access.assertAccess({
      userId: user.id,
      userRole: user.role,
      tenantId,
      scope: file.scope,
      scopeId: file.scope_id ?? undefined,
      action: 'DELETE',
    });

    // Enforce retention policy(only super admin can override)
    if (
      file.retention_until &&
      file.retention_until > new Date() &&
      user.role !== UserRole.SUPER_ADMIN
    ) {
      throw new FileUnderRetentionException(file.retention_until);
    }

    await this.prisma.repositoryFile.update({
      where: { id: fileId },
      data: { status: FileStatus.ARCHIVED },
    });

    await this.logAccess(fileId, tenantId, user.id, 'ARCHIVE');

    return { message: 'File archived successfully' };
  }

  // TODO: Shallow delete (Hard delete)
  // async shallowDelete(fileId: string, user: { id: string; role: UserRole }) {
  //   const tenantId = this.cls.get<string>('tenantId');
  //   const file = await this.findOne(fileId, user);

  //   await this.access.assertAccess({
  //     userId: user.id,
  //     userRole: user.role,
  //     tenantId,
  //     scope: file.scope,
  //     scopeId: file.scope_id ?? undefined,
  //     action: 'DELETE',
  //   });

  //   await this.prisma.repositoryFile.delete({
  //     where: { id: fileId },
  //   });

  //   await this.logAccess(fileId, tenantId, user.id, 'DELETE');

  //   // Delete all versions
  //   await this.prisma.repositoryFileVersion.deleteMany({
  //     where: { file_id: fileId, tenant_id: tenantId },
  //   });

  //   // Delete all share links
  //   await this.prisma.repositoryShareLink.deleteMany({
  //     where: { file_id: fileId, tenant_id: tenantId },
  //   });

  //   // Delete all access logs
  //   await this.prisma.repositoryFileAccessLog.deleteMany({
  //     where: { file_id: fileId, tenant_id: tenantId },
  //   });

  //   // Delete the file
  //   await this.prisma.repositoryFile.delete({
  //     where: { id: fileId },
  //   });

  //   return { message: 'File deleted successfully' };
  // }

  // Share Link
  async generateShareLink(
    fileId: string,
    user: { id: string; role: UserRole },
    dto: GenerateShareLinkDto,
  ) {
    const tenantId = this.cls.get<string>('tenantId');
    const file = await this.findOne(fileId, user);

    if (NO_SHARE_LINK_SCOPES.includes(file.scope)) {
      throw new ShareLinkNotAllowedException();
    }

    const expiryHour: Record<string, number> = {
      '1h': 1,
      '24h': 24,
      '7d': 168,
    };
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHour[dto.expiry]);

    const token = uuidv4();

    const link = await this.prisma.repositoryShareLink.create({
      data: {
        tenant_id: tenantId,
        file_id: fileId,
        token,
        created_by: user.id,
        expires_at: expiresAt,
        max_access_count: dto.max_access ?? null,
      },
    });

    await this.logAccess(fileId, tenantId, user.id, 'SHARE_LINK_GENERATED');

    return {
      token: link.token,
      expires_at: link.expires_at,
      max_access_count: link.max_access_count,
      message: 'Share link generated successfully',
      share_url: `${process.env.APP_URL}/share/${token}`,
    };
  }

  // Access share link
  async accessShareLink(token: string, req: Request) {
    const link = await this.prisma.repositoryShareLink.findFirst({
      where: { token },
      include: {
        file: {
          include: {
            versions: { orderBy: { version_number: 'desc' }, take: 1 },
          },
        },
      },
    });

    if (!link) throw new ShareLinkNotFoundException();
    if (link.expires_at && link.expires_at < new Date()) {
      throw new ShareLinkExpiredException();
    }

    if (link.max_access_count && link.access_count >= link.max_access_count) {
      throw new ShareLinkMaxAccessException();
    }

    if (link.file.status !== FileStatus.ACTIVE) {
      throw new FileArchivedException();
    }

    await this.prisma.repositoryShareLink.update({
      where: { id: link.id },
      data: { access_count: { increment: 1 } },
    });

    await this.logAccess(
      link.file.id,
      link.tenant_id,
      null,
      'SHARE_LINK_ACCESSED',
      req,
      token,
    );

    const currentVersion = link.file.versions[0];

    return {
      name: link.file.name,
      description: link.file.description,
      file_url: currentVersion?.file_url,
      mime_type: currentVersion?.mime_type,
      expires_at: link.expires_at,
    };
  }

  // Revoke share link
  async revokeShareLink(
    fileId: string,
    linkId: string,
    user: { id: string; role: UserRole },
  ) {
    await this.findOne(fileId, user);

    const link = await this.prisma.repositoryShareLink.delete({
      where: { id: linkId, file_id: fileId },
    });
    if (!link) throw new ShareLinkNotFoundException();

    // await this.logAccess(fileId, link.tenant_id, user.id, 'SHARE_LINK_REVOKED');

    await this.prisma.repositoryShareLink.delete({
      where: { id: linkId },
    });

    return { message: 'Share link revoked successfully' };
  }

  // ACCESS LOGGING
  private async logAccess(
    fileId: string,
    tenantId: string,
    userId: string | null,
    action: string,
    req?: Request,
    shareToken?: string,
  ) {
    await this.prisma.repositoryFileAccessLog.create({
      data: {
        tenant_id: tenantId,
        file_id: fileId,
        user_id: userId ?? null,
        share_token: shareToken ?? null,
        action,
        ip_address: req?.ip ?? null,
        user_agent: req?.headers['user-agent'] ?? '',
      },
    });
  }
}
