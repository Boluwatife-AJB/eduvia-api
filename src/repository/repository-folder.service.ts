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
        parent_folder_id: dto.parent_folder_id,
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

    return {
      folder,
      subFolders,
      files,
    };
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
      data: { name: dto.name },
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
}
