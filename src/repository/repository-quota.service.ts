import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { StorageQuotaExceededException } from 'src/errors/exceptions/business.exception';
import { TenantStoragePlan } from 'src/generated/prisma/enums';

const PLAN_QUOTA: Record<string, bigint> = {
  free: BigInt(2 * 1024 * 1024 * 1024), // 2GB
  basic: BigInt(10 * 1024 * 1024 * 1024), // 10GB
  standard: BigInt(20 * 1024 * 1024 * 1024), // 20GB
  premium: BigInt(50 * 1024 * 1024 * 1024), // 50GB
  enterprise: BigInt(Number.MAX_SAFE_INTEGER), // Unlimited
};

const WARNING_THRESHOLD = 0.8; // Warn at 80%
const CRITICAL_THRESHOLD = 0.95; // Critical at 95%

@Injectable()
export class RepositoryQuotaService {
  private readonly logger = new Logger(RepositoryQuotaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async assertUploadAllowed(tenantId: string, fileSize: bigint): Promise<void> {
    const storage = await this.getOrCreateStorage(tenantId);
    const afterUpload = storage.used_bytes + fileSize;

    if (afterUpload > storage.quota_bytes) {
      const quotaGB = Number(storage.quota_bytes) / (1024 * 1024 * 1024);
      throw new StorageQuotaExceededException(quotaGB);
    }

    // Log warnings at thresholds but don't block
    const usageRatio = Number(storage.used_bytes) / Number(storage.quota_bytes);

    if (usageRatio > WARNING_THRESHOLD && usageRatio < CRITICAL_THRESHOLD) {
      this.logger.warn(
        `Tenant '${tenantId}' is at ${Math.round(usageRatio * 100)}% storage capacity`,
      );
    } else if (usageRatio >= CRITICAL_THRESHOLD) {
      this.logger.error(
        `Tenant '${tenantId}' is at ${Math.round(usageRatio * 100)}% storage capacity`,
      );
    }
  }

  // Called after successful upload confirmation
  async incrementUsage(tenantId: string, fileSizeBytes: bigint): Promise<void> {
    await this.prisma.tenantStorage.upsert({
      where: { tenant_id: tenantId },
      create: {
        tenant_id: tenantId,
        used_bytes: fileSizeBytes,
        quota_bytes: PLAN_QUOTA['free'],
        plan: TenantStoragePlan.FREE,
      },
      update: {
        used_bytes: { increment: fileSizeBytes },
      },
    });
  }

  // Called after file or version deletion
  async decrementUsage(tenantId: string, fileSizeBytes: bigint): Promise<void> {
    const storage = await this.getOrCreateStorage(tenantId);
    const newUsed = storage.used_bytes - fileSizeBytes;

    await this.prisma.tenantStorage.update({
      where: { tenant_id: tenantId },
      data: { used_bytes: newUsed < 0n ? 0n : newUsed },
    });
  }

  async getUsageSummary(tenantId: string) {
    const storage = await this.getOrCreateStorage(tenantId);
    const usedGB = Number(storage.used_bytes) / (1024 * 1024 * 1024);
    const quotaGB = Number(storage.quota_bytes) / (1024 * 1024 * 1024);

    return {
      plan: storage.plan,
      used_bytes: storage.used_bytes.toString(),
      quota_bytes: storage.quota_bytes.toString(),
      usedGB: Math.round(usedGB * 100) / 100,
      quotaGB: Math.round(quotaGB * 100) / 100,
      usedPercent: Math.round((usedGB / quotaGB) * 100),
      isWarning: usedGB / quotaGB >= WARNING_THRESHOLD,
      isCritical: usedGB / quotaGB >= CRITICAL_THRESHOLD,
    };
  }

  // Returns per-scope storage breakdown
  async getUsageBreakdown(tenantId: string) {
    const files = await this.prisma.repositoryFileVersion.findMany({
      where: { tenant_id: tenantId },
      include: { file: { select: { scope: true } } },
    });

    const breakdown: Record<string, number> = {};

    for (const version of files) {
      const scope = version.file.scope;
      breakdown[scope] =
        (breakdown[scope] ?? 0) + Number(version.file_size_bytes);
    }

    return Object.entries(breakdown).map(([scope, bytes]) => ({
      scope,
      usedBytes: bytes.toString(),
      usedMB: Math.round((bytes / (1024 * 1024)) * 100) / 100,
    }));
  }

  // Private helper methods
  private async getOrCreateStorage(tenantId: string) {
    return this.prisma.tenantStorage.upsert({
      where: { tenant_id: tenantId },
      create: {
        tenant_id: tenantId,
        used_bytes: 0n,
        quota_bytes: PLAN_QUOTA['free'],
        plan: TenantStoragePlan.FREE,
      },
      update: {},
    });
  }
}
