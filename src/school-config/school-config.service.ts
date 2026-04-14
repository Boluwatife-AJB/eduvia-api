import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { GpaCalculatorService } from 'src/assessment/gpa-calculator.service';
import {
  GradeScale,
  GradingResult,
} from 'src/assessment/interfaces/assessment.interface';
import { PrismaService } from 'src/database/prisma.service';
import {
  PaymentCategory,
  PaymentStatus,
  Prisma,
  SchoolConfig,
  SchoolType,
} from 'src/generated/prisma/client';
import { UpdateSchoolConfigDto } from './dto/school-config.dto';

const CONFIG_CACHE_TTL = 300_000; // 5 minutes
const DEFAULT_GRADING_SCALE: GradeScale[] = [
  {
    grade: 'A',
    min_score: 70,
    max_score: 100,
    points: 5.0,
    remark: 'Excellent',
  },
  {
    grade: 'B',
    min_score: 60,
    max_score: 69,
    points: 4.0,
    remark: 'Very Good',
  },
  { grade: 'C', min_score: 50, max_score: 59, points: 3.0, remark: 'Good' },
  { grade: 'D', min_score: 45, max_score: 49, points: 2.0, remark: 'Fair' },
  { grade: 'E', min_score: 40, max_score: 44, points: 1.0, remark: 'Poor' },
  { grade: 'F', min_score: 0, max_score: 39, points: 0.0, remark: 'Fail' },
];

function toJsonGradeScale(scale: GradeScale[]): Prisma.JsonArray {
  return scale.map(
    (item): Prisma.JsonObject => ({
      grade: item.grade,
      min_score: item.min_score,
      max_score: item.max_score,
      points: item.points,
      remark: item.remark,
    }),
  );
}

@Injectable()
export class SchoolConfigService {
  private readonly logger = new Logger(SchoolConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gpaCalc: GpaCalculatorService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getConfig(tenantId: string) {
    const cacheKey = `school-config:${tenantId}`;

    // Try cache first
    const cached = await this.cache.get<SchoolConfig>(cacheKey);
    if (cached) return cached;

    const config = await this.prisma.schoolConfig.findUnique({
      where: { tenant_id: tenantId },
    });

    const result = config ?? this.getDefaultConfig(tenantId);

    // Store in cache
    await this.cache.set(cacheKey, result, CONFIG_CACHE_TTL);

    return result;
  }

  async updateConfig(
    tenantId: string,
    dto: UpdateSchoolConfigDto,
    adminId: string,
  ) {
    // Validate weights
    if (dto.ca_weight !== undefined && dto.exam_weight !== undefined) {
      if (dto.ca_weight + dto.exam_weight !== 100) {
        throw new BadRequestException(
          'CA weight and exam weight must sum to 100',
        );
      }
    }

    if (dto.grading_scale) {
      this.validateGradeScale(dto.grading_scale);
    }

    const config = await this.prisma.schoolConfig.upsert({
      where: { tenant_id: tenantId },
      create: {
        tenant_id: tenantId,
        ...dto,
        grading_scale: dto.grading_scale
          ? toJsonGradeScale(dto.grading_scale)
          : toJsonGradeScale(DEFAULT_GRADING_SCALE),
      },
      update: {
        ...dto,
        grading_scale: dto.grading_scale
          ? toJsonGradeScale(dto.grading_scale)
          : undefined,
      },
    });

    // Invalidate cache
    await this.cache.del(`school-config:${tenantId}`);

    this.logger.log(
      `School config updated for tenant '${tenantId}' by '${adminId}'`,
    );

    return config;
  }

  applyGradeScale(percentage: number, scale: GradeScale[]): GradingResult {
    return this.gpaCalc.applyGradeScale(percentage, scale);
  }

  isPublicSchool(config: Pick<SchoolConfig, 'school_type'>): boolean {
    return config.school_type === SchoolType.PUBLIC;
  }

  // Returns WAIVED status for public schools automatically
  // TODO: Add payment categories for mixed schools (i.e schools that has some of the fees waived and some not)
  getPaymentStatus(
    config: { school_type: SchoolType },
    category: PaymentCategory,
  ): PaymentStatus {
    if (this.isPublicSchool(config) && category === PaymentCategory.TUITION) {
      return PaymentStatus.WAIVED;
    }
    return PaymentStatus.PENDING;
  }

  async validateExamWeightConfig(tenantId: string) {
    const config = await this.getConfig(tenantId);
    if (!config) return;

    if (
      config.ca_weight === undefined ||
      config.exam_weight === undefined ||
      config.ca_weight + config.exam_weight !== 100
    ) {
      throw new BadRequestException(
        'School grading weights are not configured correctly. ' +
          'CA weight and Exam weight must be set and must sum to 100. ' +
          'Go to School Settings to configure them.',
      );
    }
  }

  // Private Helpers
  private validateGradeScale(scale: GradeScale[]) {
    // Sort by min score
    const sortedScale = [...scale].sort((a, b) => a.min_score - b.min_score);

    // Check full coverage from 0 to 100
    if (sortedScale[0].min_score !== 0) {
      throw new BadRequestException('Grading scale must start at 0');
    }
    if (sortedScale[sortedScale.length - 1].max_score !== 100) {
      throw new BadRequestException('Grading scale must end at 100');
    }

    // Check for overlaps
    for (let i = 0; i < sortedScale.length - 1; i++) {
      const prev = sortedScale[i - 1];
      const curr = sortedScale[i];

      if (curr.min_score !== prev.max_score + 1) {
        throw new BadRequestException(
          `Gap or overlap in grading scale between ${prev.max_score} and ${curr.min_score}`,
        );
      }
    }
  }

  private getDefaultConfig(tenantId: string): Partial<SchoolConfig> {
    return {
      tenant_id: tenantId,
      school_type: SchoolType.PRIVATE,
      ca_weight: 40,
      exam_weight: 60,
      pass_mark: 40,
      gpa_scale: 5.0,
      grading_scale: toJsonGradeScale(DEFAULT_GRADING_SCALE),
      require_result_approval: true,
      require_exam_approval: true,
      currency_code: 'NGN',
      currency_symbol: '₦',
    };
  }
}
