import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Resend } from 'resend';
import * as ejs from 'ejs';
import * as path from 'path';
import * as fs from 'fs/promises';
import { PrismaService } from 'src/database/prisma.service';
import { QUEUE_NAMES } from 'src/queue/queue.module';
import {
  EmailStatus,
  EmailTemplate,
  QueueEmailPayload,
} from './interfaces/email.interfaces';

@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly logger = new Logger(EmailService.name);
  private readonly templateCache = new Map<string, string>();
  private readonly templatesDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_NAMES.EMAILS)
    private readonly emailQueue: Queue,
  ) {
    this.resend = new Resend(this.config.get('RESEND_API_KEY'));
    this.templatesDir = path.join(__dirname, 'templates');
  }

  async queue(payload: QueueEmailPayload): Promise<string> {
    const log = await this.prisma.emailLog.create({
      data: {
        tenant_id: payload.tenant_id,
        to: payload.to,
        subject: payload.subject,
        template: payload.template,
        payload: payload.data,
        status: 'QUEUED' as EmailStatus,
      },
    });

    await this.emailQueue.add(
      'send-email',
      { email_log_id: log.id },
      { jobId: log.id },
    );

    return log.id;
  }

  // Send Queue
  async sendQueued(emailLogId: string): Promise<void> {
    const log = await this.prisma.emailLog.findUnique({
      where: { id: emailLogId },
    });

    if (!log) throw new Error(`Email log ${emailLogId} not found`);
    if (log.status === 'SENT') return;

    try {
      const html = await this.renderTemplate(
        log.template as EmailTemplate,
        log.payload as Record<string, any>,
      );

      const senderName = await this.getSenderName(log.tenant_id);

      const result = await this.resend.emails.send({
        from: `${senderName} <noreply@eduvia.com>`,
        to: log.to,
        subject: log.subject,
        html,
      });

      await this.prisma.emailLog.update({
        where: { id: emailLogId },
        data: {
          status: 'SENT' as EmailStatus,
          sent_at: new Date(),
          message_id: result.data?.id ?? null,
        },
      });

      this.logger.log(`Email sent: [${log.template}] to ${log.to.join(', ')}`);
    } catch (error) {
      await this.prisma.emailLog.update({
        where: { id: emailLogId },
        data: {
          status: 'QUEUED' as EmailStatus,
          error_log: (error as Error).message,
          timestamp: new Date().toISOString(),
          attempts: log.attempts + 1,
        },
      });

      throw error;
    }
  }

  // Template Renderer
  private async renderTemplate(
    template: EmailTemplate,
    data: Record<string, any>,
  ): Promise<string> {
    const templatePath = path.join(this.templatesDir, `${template}.ejs`);

    // Check cache first
    let templateStr = this.templateCache.get(template);

    if (!templateStr) {
      try {
        templateStr = await fs.readFile(templatePath, 'utf8');
      } catch (error) {
        this.logger.error(
          `Email template not found: ${template}.ejs at ${templatePath}`,
        );
        throw new Error(
          `Email template not found: ${template}.ejs at ${templatePath}. Error: ${error}`,
        );
      }

      // Cache in production, in development reload every time
      if (this.config.get('NODE_ENV') === 'production') {
        this.templateCache.set(template, templateStr);
      }
    }

    return ejs.render(templateStr, data, {
      filename: templatePath,
      cache: false,
    });
  }

  // Helpers
  private async getSenderName(tenantId: string | null): Promise<string> {
    if (!tenantId) return 'Eduvia';
    const config = await this.prisma.schoolConfig.findUnique({
      where: { tenant_id: tenantId },
      select: { email_sender_name: true },
    });

    return config?.email_sender_name ?? 'Eduvia';
  }
}
