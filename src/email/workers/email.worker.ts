import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from 'src/queue/queue.module';
import { EmailService } from '../email.service';
import { Logger } from '@nestjs/common';

export interface EmailJobPayload {
  email_log_id: string;
}

@Processor(QUEUE_NAMES.EMAILS, {
  concurrency: 10,
})
export class EmailWorker extends WorkerHost {
  private readonly logger = new Logger(EmailWorker.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job<EmailJobPayload>): Promise<void> {
    this.logger.log(
      `Processing email job: ${job.id} emailLogId: ${job.data.email_log_id}`,
    );

    await this.emailService.sendQueued(job.data.email_log_id);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Email job completed: ${job.id}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Email job ${job.id} failed permanently after ${job.attemptsMade} attempts: ${error.message}`,
    );
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.warn(`Email job ${jobId} stalled — will be retried`);
  }
}
