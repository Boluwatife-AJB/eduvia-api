import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from 'src/database/prisma.service';
import { RepositoryAccessService } from './repository-access.service';
import {
  CreateFolderDto,
  ListFoldersDto,
  RenameFolderDto,
} from './dto/folder.dto';
import {
  FolderAlreadyExistsException,
  FolderMaxDepthException,
  FolderNotEmptyException,
  FolderNotFoundException,
} from 'src/errors/exceptions/business.exception';
import { UserRole } from 'src/generated/prisma/enums';

@Injectable()
export class RepositoryFolderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RepositoryAccessService,
    private readonly cls: ClsService,
  ) {}

  async create(dto: CreateFolderDto, user: { id: string; role: UserRole }) {
    const tenantId = this.cls.get<string>('tenantId');
    await this.access.assertAccess({
      userId: user.id,
      userRole: user.role,
      tenantId,
      scope: dto.scope,
      scopeId: dto.scope_id,
      action: 'CREATE_FOLDER',
    });

    // Determine depth
    let depth = 0;
    if (dto.parent_folder_id) {
      const parentFolder = await this.prisma.repositoryFolder.findFirst({
        where: { id: dto.parent_folder_id, tenant_id: tenantId },
      });
      if (!parentFolder) throw new FolderNotFoundException();
      if (parentFolder.depth >= 2) throw new FolderMaxDepthException(); // Max depth is 2 (0,1,2)
      depth = parentFolder.depth + 1;
    }

    // Check name uniqueness within parent folder
    const nameExists = await this.prisma.repositoryFolder.findFirst({
      where: {
        name: dto.name,
        parent_folder_id: dto.parent_folder_id,
        tenant_id: tenantId,
        scope: dto.scope,
        scope_id: dto.scope_id,
      },
    });
    if (nameExists) throw new FolderAlreadyExistsException(dto.name);

    return this.prisma.repositoryFolder.create({
      data: {
        tenant_id: tenantId,
        name: dto.name,
        scope: dto.scope,
        scope_id: dto.scope_id ?? null,
        parent_folder_id: dto.parent_folder_id ?? null,
        depth,
        created_by: user.id,
      },
    });
  }

  // List folders
  async list(dto: ListFoldersDto, user: { id: string; role: UserRole }) {
    const tenantId = this.cls.get<string>('tenantId');

    await this.access.assertAccess({
      userId: user.id,
      userRole: user.role,
      tenantId,
      scope: dto.scope,
      scopeId: dto.scope_id,
      action: 'VIEW',
    });

    return this.prisma.repositoryFolder.findMany({
      where: {
        tenant_id: tenantId,
        scope: dto.scope,
        scope_id: dto.scope_id,
        parent_folder_id: dto.parent_folder_id ?? null,
      },
      include: {
        children: {
          select: {
            id: true,
            name: true,
            depth: true,
          },
        },
        _count: {
          select: {
            files: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  // Get folder contents
  async getContents(folderId: string, user: { id: string; role: UserRole }) {
    const tenantId = this.cls.get<string>('tenantId');

    const folder = await this.prisma.repositoryFolder.findFirst({
      where: { id: folderId, tenant_id: tenantId },
    });
    if (!folder) throw new FolderNotFoundException();

    await this.access.assertAccess({
      userId: user.id,
      userRole: user.role,
      tenantId,
      scope: folder.scope,
      scopeId: folder.scope_id ?? undefined,
      action: 'VIEW',
    });

    const [subFolders, files] = await Promise.all([
      this.prisma.repositoryFolder.findMany({
        where: { parent_folder_id: folderId, tenant_id: tenantId },
        include: {
          _count: {
            select: {
              files: true,
              children: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.repositoryFile.findMany({
        where: { folder_id: folderId, tenant_id: tenantId },
        include: {
          versions: { orderBy: { version_number: 'desc' }, take: 1 },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    const filesWithUploader = await this.hydrateUploadedByUsers(
      files,
      tenantId,
    );

    return this.serializeBigInts({
      folder,
      sub_folders: subFolders,
      // Include the mime_type to the file details instead of the version
      files: filesWithUploader,
    });
  }

  // Rename folder
  async rename(
    folderId: string,
    dto: RenameFolderDto,
    user: { id: string; role: UserRole },
  ) {
    const tenantId = this.cls.get<string>('tenantId');

    const folder = await this.prisma.repositoryFolder.findFirst({
      where: { id: folderId, tenant_id: tenantId },
    });
    if (!folder) throw new FolderNotFoundException();

    await this.access.assertAccess({
      userId: user.id,
      userRole: user.role,
      tenantId,
      scope: folder.scope,
      scopeId: folder.scope_id ?? undefined,
      action: 'RENAME_FOLDER',
    });

    // Check name uniqueness within parent folder
    const nameExists = await this.prisma.repositoryFolder.findFirst({
      where: {
        name: dto.name,
        parent_folder_id: folder.parent_folder_id,
        tenant_id: tenantId,
        scope: folder.scope,
        scope_id: folder.scope_id ?? undefined,
      },
    });
    if (nameExists && nameExists.id !== folderId)
      throw new FolderAlreadyExistsException(dto.name);

    return this.prisma.repositoryFolder.update({
      where: { id: folderId },
      data: { name: dto.name, updated_at: new Date() },
    });
  }

  // Delete folder
  async delete(folderId: string, user: { id: string; role: UserRole }) {
    const tenantId = this.cls.get<string>('tenantId');

    const folder = await this.prisma.repositoryFolder.findFirst({
      where: { id: folderId, tenant_id: tenantId },
      include: { _count: { select: { files: true, children: true } } },
    });
    if (!folder) throw new FolderNotFoundException();

    await this.access.assertAccess({
      userId: user.id,
      userRole: user.role,
      tenantId,
      scope: folder.scope,
      scopeId: folder.scope_id ?? undefined,
      action: 'DELETE',
    });

    // You cannot delete a folder that still contains files or subfolders
    if (folder._count.files > 0 || folder._count.children > 0) {
      throw new FolderNotEmptyException();
    }

    await this.prisma.repositoryFolder.delete({
      where: { id: folderId },
    });

    return { message: 'Folder deleted successfully' };
  }

  private serializeBigInts<T>(value: T): T {
    if (typeof value === 'bigint') {
      return value.toString() as T;
    }

    if (value instanceof Date) {
      return value.toISOString() as T;
    }

    if (Array.isArray(value)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value.map((item) => this.serializeBigInts(item)) as T;
    }

    if (value && typeof value === 'object') {
      const serialized = Object.entries(
        value as Record<string, unknown>,
      ).reduce(
        (acc, [key, val]) => {
          acc[key] = this.serializeBigInts(val);
          return acc;
        },
        {} as Record<string, unknown>,
      );

      return serialized as T;
    }

    return value;
  }

  private async hydrateUploadedByUsers(
    files: Array<{
      uploaded_by: string;
      versions?: Array<{ uploaded_by: string }>;
      [key: string]: unknown;
    }>,
    tenantId: string,
  ) {
    const uploaderIds = new Set<string>();

    files.forEach((file) => {
      if (file.uploaded_by) uploaderIds.add(file.uploaded_by);
      file.versions?.forEach((version) => {
        if (version.uploaded_by) uploaderIds.add(version.uploaded_by);
      });
    });

    if (uploaderIds.size === 0) return files;

    const users = await this.prisma.user.findMany({
      where: { tenant_id: tenantId, id: { in: [...uploaderIds] } },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        avatar: true,
        student_profile: { select: { matric_number: true } },
        teacher_profile: { select: { employee_id: true } },
        staff_profile: { select: { employee_id: true } },
      },
    });

    const userById = new Map(
      users.map((entry) => [entry.id, this.formatUploadedBy(entry)]),
    );

    return files.map((file) => ({
      ...file,
      uploaded_by: this.fallbackUploadedBy(
        userById.get(file.uploaded_by),
        file.uploaded_by,
      ),
      versions: file.versions?.map((version) => ({
        ...version,
        uploaded_by: this.fallbackUploadedBy(
          userById.get(version.uploaded_by),
          version.uploaded_by,
        ),
      })),
    }));
  }

  private fallbackUploadedBy(
    uploadedBy:
      | {
          profile_img: string;
          first_name: string;
          last_name: string;
          uuid: string;
          matric_number?: string;
          teacher_id?: string;
          staff_id?: string;
        }
      | undefined,
    uuid: string,
  ) {
    return (
      uploadedBy ?? {
        profile_img: '',
        first_name: '',
        last_name: '',
        uuid,
      }
    );
  }

  private formatUploadedBy(user: {
    id: string;
    first_name: string;
    last_name: string;
    avatar: string | null;
    student_profile: { matric_number: string } | null;
    teacher_profile: { employee_id: string } | null;
    staff_profile: { employee_id: string } | null;
  }) {
    const base = {
      profile_img: user.avatar ?? '',
      first_name: user.first_name ?? '',
      last_name: user.last_name ?? '',
      uuid: user.id,
    };

    if (user.student_profile?.matric_number) {
      return {
        ...base,
        matric_number: user.student_profile.matric_number,
      };
    }

    if (user.teacher_profile?.employee_id) {
      return {
        ...base,
        teacher_id: user.teacher_profile.employee_id,
      };
    }

    if (user.staff_profile?.employee_id) {
      return {
        ...base,
        staff_id: user.staff_profile.employee_id,
      };
    }

    return base;
  }
}
