import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from 'src/database/prisma.service';
import { StorageService } from 'src/storage/storage.service';

// Fields returned with every lecture response
const LECTURE_SELECT = {
  id: true,
  title: true,
  description: true,
  content_type: true,
  status: true,
  file_url: true,
  external_url: true,
  text_content: true,
  duration_mins: true,
  file_size: true,
  order: true,
  published_at: true,
  created_at: true,
  subject: { select: { id: true, name: true, code: true } },
  class: { select: { id: true, name: true } },
  term: { select: { id: true, name: true } },
  // Never return fileKey in responses — it is an internal storage detail
};

@Injectable()
export class LecturesService {
  private readonly logger = new Logger(LecturesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly storage: StorageService,
  ) {}
}
