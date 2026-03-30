import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailWorker } from './workers/email.worker';

@Module({
  providers: [EmailService, EmailWorker],
  exports: [EmailService],
})
export class EmailModule {}
