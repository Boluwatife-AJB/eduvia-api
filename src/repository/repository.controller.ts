import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Public } from 'src/auth/decorators/public.decorator';
import { UserRole } from 'src/generated/prisma/enums';
import {
  AddNewVersionDto,
  CreateRepositoryFileDto,
  GenerateShareLinkDto,
  ListFilesDto,
  UpdateFileMetaDto,
} from './dto/file.dto';
import {
  CreateFolderDto,
  ListFoldersDto,
  RenameFolderDto,
} from './dto/folder.dto';
import { RepositoryFileService } from './repository-file.service';
import { RepositoryFolderService } from './repository-folder.service';
import { RepositoryQuotaService } from './repository-quota.service';

@ApiTags('Repository')
@ApiBearerAuth()
@Controller('repository')
export class RepositoryController {
  constructor(
    private readonly fileService: RepositoryFileService,
    private readonly folderService: RepositoryFolderService,
    private readonly quotaService: RepositoryQuotaService,
  ) {}

  // Folders
  @Post('folders')
  @ApiOperation({ summary: 'Create a folder within a repository scope' })
  createFolder(
    @Body() dto: CreateFolderDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.folderService.create(dto, user);
  }

  @Get('folders')
  @ApiOperation({ summary: 'List root folders within a scope' })
  listFolders(
    @Query() dto: ListFoldersDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.folderService.list(dto, user);
  }

  @Get('folders/:id/contents')
  @ApiOperation({ summary: 'Get folder contents — subfolders and files' })
  getFolderContents(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.folderService.getContents(id, user);
  }

  @Put('folders/:id')
  @ApiOperation({ summary: 'Rename a folder' })
  renameFolder(
    @Param('id') id: string,
    @Body() dto: RenameFolderDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.folderService.rename(id, dto, user);
  }

  @Delete('folders/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an empty folder' })
  deleteFolder(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.folderService.delete(id, user);
  }

  // FILES
  @Post('files')
  @ApiOperation({
    summary: 'Create a repository file record',
    description:
      'Upload the file first via POST /upload (small files) or POST /upload/confirm (large files). Pass the returned fileUrl and fileKey here to create the record.',
  })
  createFile(
    @Body() dto: CreateRepositoryFileDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.fileService.createFileRecord(dto, user);
  }

  @Get('files')
  @ApiOperation({ summary: 'List and search files within accessible scopes' })
  listFiles(
    @Query() dto: ListFilesDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.fileService.findAll(dto, user);
  }

  @Get('files/:id')
  @ApiOperation({
    summary: 'Get file details — logs access for sensitive scopes',
  })
  getFile(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: UserRole },
    @Req() req: Request,
  ) {
    return this.fileService.findOne(id, user, req);
  }

  @Get('files/:id/versions')
  @ApiOperation({ summary: 'Get full version history for a file' })
  getVersionHistory(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.fileService.getVersionHistory(id, user);
  }

  @Post('files/:id/versions')
  @ApiOperation({
    summary: 'Add a new version to an existing file',
    description:
      'Upload the new version via POST /upload first, then pass fileUrl and fileKey here.',
  })
  addNewVersion(
    @Param('id') id: string,
    @Body() dto: AddNewVersionDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.fileService.addNewVersion(id, dto, user);
  }

  @Put('files/:id')
  @ApiOperation({ summary: 'Update file name, description or tags' })
  updateMetadata(
    @Param('id') id: string,
    @Body() dto: UpdateFileMetaDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.fileService.updateMetadata(id, dto, user);
  }

  @Delete('files/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a file — respects retention policy' })
  deleteFile(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.fileService.softDelete(id, user);
  }

  @Delete('files/:id/versions/:versionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a specific old version to free storage' })
  deleteVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.fileService.deleteVersion(id, versionId, user);
  }

  // SHARING
  @Post('files/:id/share')
  @ApiOperation({ summary: 'Generate a temporary share link for a file' })
  generateShareLink(
    @Param('id') id: string,
    @Body() dto: GenerateShareLinkDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.fileService.generateShareLink(id, user, dto);
  }

  @Public()
  @Get('share/:token')
  @ApiOperation({
    summary: 'Access a file via share link, no authentication required',
  })
  accessShareLink(@Param('token') token: string, @Req() req: Request) {
    return this.fileService.accessShareLink(token, req);
  }

  @Delete('files/:id/share/:linkId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a share link' })
  revokeShareLink(
    @Param('id') id: string,
    @Param('linkId') linkId: string,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.fileService.revokeShareLink(id, linkId, user);
  }

  // STORAGE
  @Get('storage/usage')
  @ApiOperation({ summary: 'Get school storage quota and usage summary' })
  getStorageUsage(@CurrentUser() user: { id: string; role: UserRole }) {
    const tenantId = user.id; // CLS provides this in service
    return this.quotaService.getUsageSummary(tenantId);
  }

  @Get('storage/breakdown')
  @ApiOperation({
    summary: 'Get storage usage broken down by repository scope',
  })
  getStorageBreakdown(@CurrentUser() user: { id: string; role: UserRole }) {
    const tenantId = user.id;
    return this.quotaService.getUsageBreakdown(tenantId);
  }
}
