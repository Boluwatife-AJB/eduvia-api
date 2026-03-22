import { Module } from '@nestjs/common';
import { UploadModule } from 'src/upload/upload.module';
import { RepositoryController } from './repository.controller';
import { RepositoryFileService } from './repository-file.service';
import { RepositoryFolderService } from './repository-folder.service';
import { RepositoryQuotaService } from './repository-quota.service';
import { RepositoryAccessService } from './repository-access.service';

@Module({
  imports: [UploadModule],
  controllers: [RepositoryController],
  providers: [
    RepositoryFileService,
    RepositoryFolderService,
    RepositoryQuotaService,
    RepositoryAccessService,
  ],
  exports: [RepositoryFileService, RepositoryQuotaService],
})
export class RepositoryModule {}
