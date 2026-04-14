import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { EmailService } from 'src/email/email.service';
import { NotificationType, UserRole } from 'src/generated/prisma/enums';

/** Matches Assessment select { title, teacher_id } for exam notifications */
interface AssessmentExamNotifyFields {
  title: string;
  teacher_id: string[];
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async createNotification(payload: {
    tenant_id: string;
    user_id: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, any>;
  }) {
    return this.prisma.notification.create({
      data: {
        tenant_id: payload.tenant_id,
        user_id: payload.user_id,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        is_read: false,
      },
    });
  }

  // Create notification for multiple users
  async createBulkNotification(payload: {
    tenant_id: string;
    user_ids: string[];
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, any>;
  }) {
    if (payload.user_ids.length === 0) return;

    await this.prisma.notification.createMany({
      data: payload.user_ids.map((userId) => ({
        tenant_id: payload.tenant_id,
        user_id: userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        is_read: false,
      })),
      skipDuplicates: true,
    });
  }

  // Exam Approval Notification
  async notifyApproversOfPendingItem(
    tenantId: string,
    resourceType: string,
    resourceId: string,
  ) {
    const approvers = await this.prisma.user.findMany({
      where: {
        tenant_id: tenantId,
        role: {
          in: [
            UserRole.PRINCIPAL,
            UserRole.HEAD_TEACHER,
            UserRole.VICE_PRINCIPAL,
            UserRole.ASST_HEAD_TEACHER,
            UserRole.HOD,
            UserRole.SCHOOL_OWNER,
          ],
        },
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
      },
    });

    if (approvers.length === 0) return;

    // In-app notifications
    await this.createBulkNotification({
      tenant_id: tenantId,
      user_ids: approvers.map((approver) => approver.id),
      type: NotificationType.EXAM,
      title: 'New Exam Approval Pending',
      body: `An ${resourceType} has been submitted for approval. Please review and approve or reject it.`,
      data: {
        resource_type: resourceType,
        resource_id: resourceId,
      },
    });
  }

  async notifyExamApproved(tenantId: string, assessmentId: string) {
    const assessment = (await this.prisma.assessment.findUnique({
      where: {
        id: assessmentId,
        tenant_id: tenantId,
      },
      select: {
        title: true,
        teacher_id: true,
      },
    })) as AssessmentExamNotifyFields | null;

    if (!assessment || assessment.teacher_id.length === 0) return;

    const { title, teacher_id: teacherIds } = assessment;

    const teacher = await this.prisma.user.findFirst({
      where: {
        id: { in: teacherIds },
        tenant_id: tenantId,
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
      },
    });

    if (!teacher) return;

    // In-app notification
    await this.createNotification({
      tenant_id: tenantId,
      user_id: teacher.id,
      type: NotificationType.EXAM,
      title: 'Exam Approved',
      body: `Your exam "${title}" has been approved.`,
      data: {
        resource_id: assessmentId,
      },
    });

    // Email notification
  }

  async notifyExamRejected(
    tenantId: string,
    assessmentId: string,
    reason: string,
  ) {
    const assessment = (await this.prisma.assessment.findUnique({
      where: {
        id: assessmentId,
        tenant_id: tenantId,
      },
      select: {
        title: true,
        teacher_id: true,
      },
    })) as AssessmentExamNotifyFields | null;

    if (!assessment || assessment.teacher_id.length === 0) return;

    const { title, teacher_id: teacherIds } = assessment;

    const teacher = await this.prisma.user.findFirst({
      where: {
        id: { in: teacherIds },
        tenant_id: tenantId,
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
      },
    });

    if (!teacher) return;

    await this.createNotification({
      tenant_id: tenantId,
      user_id: teacher.id,
      type: NotificationType.EXAM,
      title: 'Exam Rejected',
      body: `Your exam "${title}" has been rejected. Reason: ${reason}`,
      data: {
        resource_id: assessmentId,
        reason,
      },
    });

    // Email notification
    if (teacher.email) {
      // TODO: Send email notification
    }
  }

  // Result Published Notification
  async notifyResultPublished(tenantId: string, termResultId: string) {
    const result = await this.prisma.termResult.findUnique({
      where: {
        id: termResultId,
      },
    });

    if (!result) return;

    const student = await this.prisma.user.findUnique({
      where: {
        id: result.student_id,
        tenant_id: tenantId,
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        // TODO: Add matric number
      },
    });

    if (!student) return;

    // const emailData = {
    //   firstName: student.firstName,
    //   termName: result.term.name,
    //   sessionName: result.term.session.name,
    //   average: result.average?.toFixed(1) ?? '-',
    //   position: result.position ?? '-',
    //   outOf: result.outOf ?? '-',
    //   termGPA: result.termGPA?.toFixed(2),
    //   resultUrl: `${process.env.FRONTEND_URL}/app/results`,
    //   pdfUrl: result.pdfUrl,
    //   schoolName: await this.getSchoolName(tenantId),
    // };

    // Notify student
    await this.createNotification({
      tenant_id: tenantId,
      user_id: student.id,
      type: NotificationType.RESULT,
      // title: `${result.term.name} results published`,
      title: 'Results Published',
      body: `Your results are ready. Average: ${result.average?.toFixed(1)}%`,
      data: { termResultId },
    });

    // Notify Parents
    const parents = await this.getParentsOfStudent(result.student_id, tenantId);
    for (const parent of parents) {
      await this.createNotification({
        tenant_id: tenantId,
        user_id: parent.id,
        type: NotificationType.RESULT,
        title: `${student.first_name}'s Results Published`,
        // body: `${student.first_name}'s ${result.term.name} results are available. Average: ${result.average?.toFixed(1) ?? '-'}%`,
        body: `${student.first_name}'s  results are available.`,
        data: { termResultId, studentId: student.id },
      });

      if (parent.email) {
        // TODO: Send email notification
      }
    }
  }

  // Payment Notifications
  async notifyPaymentConfirmed(tenantId: string, paymentId: string) {
    const payment = await this.prisma.studentPayment.findUnique({
      where: {
        id: paymentId,
      },
      // include: { fee_item: true },
    });

    if (!payment) return;

    const student = await this.prisma.user.findFirst({
      where: { id: payment.student_id },
      select: { id: true, email: true, first_name: true, last_name: true },
    });

    if (!student) return;

    const schoolConfig = await this.prisma.schoolConfig.findUnique({
      where: { tenant_id: tenantId },
    });

    // const emailData = {
    //   firstName: student.firstName,
    //   amount: payment.amountPaid.toLocaleString(),
    //   feeName: payment.feeItem?.name ?? 'School Fee',
    //   receiptNumber: payment.receiptNumber,
    //   reference: payment.reference,
    //   date: payment.paidAt?.toLocaleDateString('en-NG') ?? '',
    //   gateway: payment.gateway ?? 'Online',
    //   lateFeeApplied: payment.lateFeeApplied,
    //   receiptUrl: payment.receiptPdfUrl ?? '',
    //   currencySymbol: schoolConfig?.currencySymbol ?? '₦',
    //   schoolName: await this.getSchoolName(tenantId),
    // };

    await this.createNotification({
      tenant_id: tenantId,
      user_id: student.id,
      type: NotificationType.FEE,
      title: 'Payment Confirmed',
      body: `Your payment has been of ${schoolConfig?.currency_code} ${payment.amount_paid.toLocaleString()} confirmed.`,
      data: { paymentId },
    });

    if (student.email) {
      // TODO: Send email notification
    }

    // Notify Parents
    const parents = await this.getParentsOfStudent(student.id, tenantId);
    for (const parent of parents) {
      await this.createNotification({
        tenant_id: tenantId,
        user_id: parent.id,
        type: NotificationType.FEE,
        title: 'Payment Confirmed',
        body: `Your child's payment has been of ${schoolConfig?.currency_code} ${payment.amount_paid.toLocaleString()} confirmed.`,
        data: { paymentId, studentId: student.id },
      });

      if (parent.email) {
        // TODO: Send email notification
      }
    }
  }

  async notifyPaymentFailed(tenantId: string, paymentId: string) {
    const payment = await this.prisma.studentPayment.findUnique({
      where: {
        id: paymentId,
      },
      // include: {
      //   fee_item: true,
      // },
    });

    if (!payment) return;

    const student = await this.prisma.user.findFirst({
      where: { id: payment.student_id },
      select: { id: true, email: true, first_name: true, last_name: true },
    });

    if (!student) return;

    const schoolConfig = await this.prisma.schoolConfig.findUnique({
      where: { tenant_id: tenantId },
    });

    await this.createNotification({
      tenant_id: tenantId,
      user_id: student.id,
      type: NotificationType.FEE,
      title: 'Payment Failed',
      body: `Your payment of ${schoolConfig?.currency_code} ${payment.amount_paid.toLocaleString()} has failed. Please try again.`,
      data: { paymentId },
    });

    // TODO: Notify Parents and notify student via email
  }

  // Salary Notifications
  async notifySalaryCredited(tenantId: string, salaryId: string) {
    const salary = await this.prisma.staffSalary.findUnique({
      where: { id: salaryId },
    });

    if (!salary) return;

    const staff = await this.prisma.user.findFirst({
      where: { id: salary.staff_id },
      select: { id: true, email: true, first_name: true, last_name: true },
    });

    if (!staff) return;

    // const schoolConfig = await this.prisma.schoolConfig.findUnique({
    //   where: { tenant_id: tenantId },
    // });

    await this.createNotification({
      tenant_id: tenantId,
      user_id: staff.id,
      type: NotificationType.ANNOUNCEMENT,
      title: 'Salary Credited',
      body: `Your salary for ${salary.month} has been processed.`,
      data: { salaryId },
    });

    if (staff.email) {
      // TODO: Send email notification
    }
  }

  // Fee Reminder Notifications
  async notifyFeeReminder(
    tenantId: string,
    feeItemId: string,
    studentId: string,
    daysLeft: number,
  ) {
    const feeItem = await this.prisma.feeItem.findUnique({
      where: { id: feeItemId },
    });

    const student = await this.prisma.user.findFirst({
      where: { id: studentId },
      select: { id: true, email: true, first_name: true, last_name: true },
    });

    const schoolConfig = await this.prisma.schoolConfig.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!feeItem || !student || !schoolConfig) return;

    await this.createNotification({
      tenant_id: tenantId,
      user_id: student.id,
      type: NotificationType.FEE,
      title: 'Fee Reminder Reminder',
      body: `${feeItem.name} is due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
      data: { feeItemId, daysLeft },
    });
  }

  private async getParentsOfStudent(tenantId: string, studentId: string) {
    const studentProfile = await this.prisma.studentProfile.findFirst({
      where: {
        user_id: studentId,
        tenant_id: tenantId,
      },
    });

    if (!studentProfile || studentProfile.guardian_ids.length === 0) return [];

    return this.prisma.user.findMany({
      where: {
        id: { in: studentProfile.guardian_ids },
        tenant_id: tenantId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
      },
    });
  }
}
