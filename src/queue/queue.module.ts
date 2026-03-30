import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService, ConfigModule } from '@nestjs/config';

export const QUEUE_NAMES = {
  EMAILS: 'emails',
  DOCUMENTS: 'documents',
  GRADING: 'grading',
  NOTIFICATIONS: 'notifications',
  PAYROLL: 'payroll',
} as const;

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD') || undefined,

          // Retry strategy
          retry_strategy: (times: number) => {
            if (times > 10) return null;
            return Math.min(times * 50, 1000);
          },
        },
      }),
      inject: [ConfigService],
    }),

    BullModule.registerQueue(
      {
        name: QUEUE_NAMES.EMAILS,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 500 },
        },
      },
      {
        name: QUEUE_NAMES.DOCUMENTS,
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'fixed', delay: 10000 },
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 200 },
        },
      },
      {
        name: QUEUE_NAMES.GRADING,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { count: 200 },
          removeOnFail: { count: 500 },
        },
      },
      {
        name: QUEUE_NAMES.NOTIFICATIONS,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { count: 200 },
          removeOnFail: { count: 500 },
        },
      },
      {
        name: QUEUE_NAMES.PAYROLL,
        defaultJobOptions: {
          // Payroll must NOT retry automatically — prevent double payments
          attempts: 1,
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 100 },
        },
      },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
