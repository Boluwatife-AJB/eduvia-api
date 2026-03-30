import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from 'src/database/prisma.service';
import {
  AssessmentNotFoundException,
  UserNotFoundException,
} from 'src/errors/exceptions/business.exception';
import {
  ApprovalAction,
  AssessmentStatus,
  UserRole,
} from 'src/generated/prisma/client';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class ApprovalWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly notify: NotificationsService,
  ) {}

  // Submit for approval
  async submitForApproval(
    resourceId: string,
    resourceType: 'assessment' | 'result',
    submittedBy: string,
  ) {
    const tenantId = this.cls.get<string>('tenantId');

    await this.prisma.$transaction(async (tx) => {
      if (resourceType === 'assessment') {
        await tx.assessment.update({
          where: { id: resourceId },
          data: {
            status: AssessmentStatus.PENDING_APPROVAL,
            submitted_for_approval: new Date(),
          },
        });
      }

      // Log the action
      await tx.approvalLog.create({
        data: {
          tenant_id: tenantId,
          resource_id: resourceId,
          resource_type: resourceType,
          action: ApprovalAction.SUBMITTED_FOR_REVIEW,
          actor_id: submittedBy,
        },
      });
    });

    // Notify admins and HOD that approval is needed
    await this.notify.notifyApproversOfPendingItem(
      tenantId,
      resourceType,
      resourceId,
    );

    return {
      message: `${resourceType} submitted for approval. An admin will review it shortly.`,
    };
  }

  // Approve
  async approve(
    resourceId: string,
    resourceType: 'assessment' | 'result',
    approverId: string,
    comment?: string,
  ) {
    const tenantId = this.cls.get<string>('tenantId');

    await this.validateApproverRole(approverId, tenantId);

    await this.prisma.$transaction(async (tx) => {
      if (resourceType === 'assessment') {
        await tx.assessment.update({
          where: { id: resourceId },
          data: {
            status: AssessmentStatus.APPROVED,
            approved_by: approverId,
            approved_at: new Date(),
            // comment: comment,
          },
        });
      }

      await tx.approvalLog.create({
        data: {
          tenant_id: tenantId,
          resource_id: resourceId,
          resource_type: resourceType,
          action: ApprovalAction.APPROVED,
          actor_id: approverId,
          comment: comment,
        },
      });
    });

    // Notify the user exam has been approved
    await this.notify.notifyExamApproved(tenantId, resourceId);

    return {
      message: `${resourceType} approved successfully.`,
    };
  }

  // Reject
  async reject(
    resourceId: string,
    resourceType: 'assessment' | 'result',
    rejectorId: string,
    reason?: string,
  ) {
    const tenantId = this.cls.get<string>('tenantId');

    if (!reason?.trim()) {
      throw new BadRequestException('Reason is required to reject an item.');
    }

    await this.validateApproverRole(rejectorId, tenantId);

    await this.prisma.$transaction(async (tx) => {
      if (resourceType === 'assessment') {
        await tx.assessment.update({
          where: { id: resourceId },
          data: {
            status: AssessmentStatus.REJECTED,
            rejected_by: rejectorId,
            rejected_at: new Date(),
            rejected_reason: reason,
          },
        });
      }

      await tx.approvalLog.create({
        data: {
          tenant_id: tenantId,
          resource_id: resourceId,
          resource_type: resourceType,
          action: ApprovalAction.REJECTED,
          actor_id: rejectorId,
          comment: reason,
        },
      });
    });

    await this.notify.notifyExamRejected(tenantId, resourceId, reason);

    return {
      message: `${resourceType} rejected successfully. Teacher has been notified.`,
    };
  }

  // Publish Approved
  // (approved != published — teacher controls when students see it)
  async publishApproved(assessmentId: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
    });

    if (!assessment) throw new AssessmentNotFoundException();

    if (assessment.status !== AssessmentStatus.APPROVED) {
      throw new BadRequestException(
        'Assessment must be approved before it can be published.',
      );
    }

    return this.prisma.assessment.update({
      where: { id: assessmentId },
      data: { status: AssessmentStatus.PUBLISHED },
    });
  }

  // Private Helper Methods
  private async validateApproverRole(userId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenant_id: tenantId },
    });

    if (!user) throw new UserNotFoundException();

    const approverRoles: UserRole[] = [
      UserRole.PRINCIPAL,
      UserRole.HEAD_TEACHER,
      UserRole.VICE_PRINCIPAL,
      UserRole.ASST_HEAD_TEACHER,
      UserRole.HOD,
      UserRole.SCHOOL_OWNER,
    ];

    if (!approverRoles.includes(user.role)) {
      throw new ForbiddenException(
        'Only admins and HODs can approve assessments.',
      );
    }
  }
}
