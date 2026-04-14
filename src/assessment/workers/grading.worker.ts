import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from 'src/queue/queue.module';
import { GradingService } from '../grading.service';

export interface GradingJobPayload {
  submission_id: string;
}
@Processor(QUEUE_NAMES.GRADING, { concurrency: 20 })
export class GradingWorker extends WorkerHost {
  private readonly logger = new Logger(GradingWorker.name);

  constructor(private readonly gradingService: GradingService) {
    super();
  }

  async process(job: Job<GradingJobPayload>): Promise<void> {
    this.logger.log(`Auto-grading submission ${job.data.submission_id}`);
    await this.gradingService.autoGradeSubmission(job.data.submission_id);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      `Grading job failed for submission ${job.data.submission_id}: ${error.message}`,
    );
  }
}
