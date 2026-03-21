import { Module } from '@nestjs/common';
import { LecturesController } from './lectures.controller';
import { LecturesService } from './lectures.service';
import { UploadModule } from 'src/upload/upload.module';
@Module({
  controllers: [LecturesController],
  providers: [LecturesService],
  imports: [UploadModule],
  exports: [LecturesService],
})
export class LecturesModule {}
