export interface QueueEmailPayload {
  tenant_id: string | null;
  to: string[];
  subject: string;
  template: string;
  data: Record<string, any>;
}

export type EmailTemplate =
  // Platform emails  'school-registration-received'
  | 'email-verification'
  | 'school-approved'
  | 'school-rejected'
  | 'school-suspended'
  | 'storage-warning-80'
  | 'storage-warning-95'
  | 'storage-quota-exceeded'

  // User account emails
  | 'account-created'
  | 'password-reset-otp'
  | 'password-changed'
  | 'account-suspended'
  | 'account-reactivated'

  // Academic emails
  | 'result-published'
  | 'exam-scheduled'
  | 'exam-approved'
  | 'exam-rejected'
  | 'assignment-due-reminder'

  // Financial emails
  | 'payment-confirmed'
  | 'payment-failed'
  | 'fee-reminder'
  | 'salary-credited'
  | 'loan-approved'
  | 'loan-repayment-reminder'

  // Administrative emails
  | 'disciplinary-notice'
  | 'pta-meeting-scheduled'
  | 'staff-meeting-scheduled'
  | 'announcement';

// Shape of the email log status
export type EmailStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED'
  | 'CANCELLED';
