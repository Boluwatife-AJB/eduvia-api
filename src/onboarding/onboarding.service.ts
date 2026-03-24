import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { RegisterSchoolDto, ReviewRegistrationDto } from './dto/onboarding.dto';
import {
  OnboardingStatus,
  TenantPlan,
  TenantStoragePlan,
} from 'src/generated/prisma/enums';

// Paystack plan codes — set these in your Paystack dashboard
const PLAN_AMOUNTS: Record<string, number> = {
  basic: 15000, // ₦15,000/month
  standard: 35000, // ₦35,000/month
  premium: 75000, // ₦75,000/month
};

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    // private readonly email: EmailService,
  ) {}

  // ─── STEP 1: Check slug availability ──────────────────────────────────────

  async checkSlugAvailability(slug: string) {
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: { id: true },
    });

    const existingRegistration =
      await this.prisma.schoolRegistration.findUnique({
        where: { slug },
        select: { id: true, status: true },
      });

    const isAvailable = !existingTenant && !existingRegistration;

    return {
      slug,
      isAvailable,
      message: isAvailable
        ? `"${slug}" is available`
        : `"${slug}" is already taken. Try "${slug}-school" or "${slug}-academy"`,
      suggestions: isAvailable
        ? []
        : [`${slug}-academy`, `${slug}-school`, `${slug}-ng`],
    };
  }

  // ─── STEP 2: Register a new school ────────────────────────────────────────

  async register(dto: RegisterSchoolDto) {
    // Check slug availability
    const slugCheck = await this.checkSlugAvailability(dto.school_slug);
    if (!slugCheck.isAvailable) {
      throw new ConflictException(
        `The slug "${dto.school_slug}" is already taken.`,
      );
    }

    // Check email is not already registered
    const existingEmail = await this.prisma.schoolRegistration.findUnique({
      where: { owner_email: dto.owner_email, slug: dto.school_slug },
    });
    if (existingEmail) {
      throw new ConflictException(
        'An application with this email already exists.',
      );
    }

    // Generate email verification token
    const emailToken = randomBytes(32).toString('hex');

    const registration = await this.prisma.schoolRegistration.create({
      data: {
        school_name: dto.school_name,
        slug: dto.school_slug,
        owner_first_name: dto.owner_first_name,
        owner_last_name: dto.owner_last_name,
        owner_email: dto.owner_email,
        owner_phone: dto.owner_phone,
        address: dto.address,
        city: dto.city,
        zip: dto.zip,
        country: dto.country,
        state: dto.state,
        student_count: dto.student_count,
        plan: dto.plan as TenantPlan,
        email_verification_token: emailToken,
        status: OnboardingStatus.PENDING_VERIFICATION,
      },
    });

    // Send verification email
    // await this.email.sendEmail(
    //   dto.ownerEmail,
    //   'Verify your Eduvia registration — ' + dto.schoolName,
    //   this.buildVerificationEmail(dto, emailToken),
    // );

    this.logger.log(
      `New school registration: ${dto.school_name} (${dto.school_slug}) by ${dto.owner_email}`,
    );

    return {
      message:
        'Registration received. Please check your email to verify your address.',
      registrationId: registration.id,
      nextStep: 'Check your email and click the verification link to continue.',
    };
  }

  // ─── STEP 3: Verify email ──────────────────────────────────────────────────

  async verifyEmail(token: string) {
    const registration = await this.prisma.schoolRegistration.findFirst({
      where: { email_verification_token: token },
    });

    if (!registration) {
      throw new BadRequestException('Invalid or expired verification link.');
    }

    if (registration.status !== 'PENDING_VERIFICATION') {
      throw new BadRequestException('This email has already been verified.');
    }

    await this.prisma.schoolRegistration.update({
      where: { id: registration.id },
      data: {
        status: 'PENDING_PAYMENT',
        email_verified_at: new Date(),
        email_verification_token: null,
      },
    });

    return {
      message: 'Email verified successfully.',
      registration_id: registration.id,
      school_name: registration.school_name,
      plan: registration.plan,
      amount: PLAN_AMOUNTS[registration.plan],
      nextStep: 'Complete payment to submit your application for review.',
    };
  }

  // ─── STEP 4: Confirm payment ───────────────────────────────────────────────

  async confirmPayment(registrationId: string, paymentRef: string) {
    const registration = await this.prisma.schoolRegistration.findUnique({
      where: { id: registrationId },
    });

    if (!registration) throw new NotFoundException('Registration not found.');

    if (registration.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException(
        'This registration is not awaiting payment.',
      );
    }

    // TODO: Verify payment with Paystack API here
    // const verified = await this.paystack.verify(paymentRef)
    // if (!verified.status) throw new BadRequestException('Payment verification failed')

    await this.prisma.schoolRegistration.update({
      where: { id: registrationId },
      data: {
        status: 'PENDING_APPROVAL',
        payment_ref: paymentRef,
        paid_at: new Date(),
      },
    });

    // Notify super admins that a new school is awaiting approval
    // TODO: Send super admin notification when notification module is complete

    this.logger.log(
      `Payment confirmed for ${registration.school_name} — awaiting approval`,
    );

    return {
      message: 'Payment confirmed. Your application is now under review.',
      next_step:
        'You will receive an email within 24 hours once your school is approved.',
    };
  }

  // ─── STEP 5: Super admin reviews registration ──────────────────────────────

  async reviewRegistration(
    registrationId: string,
    dto: ReviewRegistrationDto,
    adminUserId: string,
  ) {
    const registration = await this.prisma.schoolRegistration.findUnique({
      where: { id: registrationId },
    });

    if (!registration) throw new NotFoundException('Registration not found.');

    if (registration.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(
        'This registration is not pending approval.',
      );
    }

    if (dto.decision === 'REJECTED') {
      if (!dto.reason) {
        throw new BadRequestException(
          'A reason is required when rejecting a registration.',
        );
      }

      await this.prisma.schoolRegistration.update({
        where: { id: registrationId },
        data: {
          status: 'REJECTED',
          rejected_reason: dto.reason,
          reviewed_by: adminUserId,
          reviewed_at: new Date(),
        },
      });

      // await this.email.sendEmail(
      //   registration.ownerEmail,
      //   'Update on your Eduvia application — ' + registration.school_name,
      //   this.buildRejectionEmail(registration, dto.reason),
      // );

      return { message: 'Registration rejected and applicant notified.' };
    }

    // APPROVED — create the tenant and owner account
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the school tenant
      const tenant = await tx.tenant.create({
        data: {
          name: registration.school_name,
          slug: registration.slug,
          email: registration.owner_email,
          phone: registration.owner_phone,
          address: `${registration.address}, ${registration.state}`,
          plan: registration.plan,
          status: 'ACTIVE',
        },
      });

      // Create the owner account
      // Default password is their email — forced to change on first login
      const passwordHash = await bcrypt.hash(registration.owner_email, 12);

      const owner = await tx.user.create({
        data: {
          tenant_id: tenant.id,
          role: 'SCHOOL_OWNER',
          identifier: `OWNER-${registration.slug.toUpperCase()}`,
          first_name: registration.owner_first_name,
          last_name: registration.owner_last_name,
          email: registration.owner_email,
          phone: registration.owner_phone,
          password_hash: passwordHash,
          status: 'ACTIVE',
        },
      });

      // Create storage quota record based on plan
      const quotaMap: Record<string, bigint> = {
        basic: BigInt(10 * 1024 * 1024 * 1024), // 10GB
        standard: BigInt(50 * 1024 * 1024 * 1024), // 50GB
        premium: BigInt(200 * 1024 * 1024 * 1024), // 200GB
      };

      await tx.tenantStorage.create({
        data: {
          tenant_id: tenant.id,
          used_bytes: BigInt(0),
          quota_bytes:
            quotaMap[registration.plan] ?? quotaMap[TenantPlan.BASIC],
          plan: TenantStoragePlan.BASIC,
        },
      });

      // Mark registration as approved
      await tx.schoolRegistration.update({
        where: { id: registrationId },
        data: {
          status: 'APPROVED',
          tenant_id: tenant.id,
          reviewed_by: adminUserId,
          reviewed_at: new Date(),
        },
      });

      return { tenant, owner };
    });

    // Send welcome email to the school owner
    // await this.email.sendEmail(
    //   registration.ownerEmail,
    //   `🎓 Welcome to Eduvia — ${registration.schoolName} is live!`,
    //   this.buildApprovalEmail(registration, result.owner.identifier),
    // );

    this.logger.log(
      `School approved and created: ${registration.school_name} (${registration.slug})`,
    );

    return {
      message: `${registration.school_name} has been approved and is now live.`,
      tenantId: result.tenant.id,
      slug: result.tenant.slug,
      login_url: `https://${result.tenant.slug}.eduvia.com/sign-in`,
    };
  }

  // ─── Super admin: list all registrations ──────────────────────────────────

  async listRegistrations(status?: string) {
    return this.prisma.schoolRegistration.findMany({
      where: status ? { status: status as OnboardingStatus } : undefined,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        school_name: true,
        slug: true,
        owner_first_name: true,
        owner_last_name: true,
        owner_email: true,
        owner_phone: true,
        address: true,
        city: true,
        zip: true,
        country: true,
        state: true,
        plan: true,
        student_count: true,
        status: true,
        paid_at: true,
        created_at: true,
      },
    });
  }

  // ─── Email templates ───────────────────────────────────────────────────────

  // private buildVerificationEmail(dto: RegisterSchoolDto, token: string) {
  //   const verifyUrl = `${process.env.FRONTEND_URL}/onboarding/verify-email?token=${token}`;
  //   return `
  //     <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto">
  //       <div style="background:#1E3A8A;padding:32px;text-align:center;border-radius:12px 12px 0 0">
  //         <h1 style="color:white;margin:0;font-size:24px">Eduvia</h1>
  //         <p style="color:#BFDBFE;margin:8px 0 0">The Path of Education</p>
  //       </div>
  //       <div style="background:white;padding:32px;border:1px solid #E2E8F0;border-radius:0 0 12px 12px">
  //         <h2 style="color:#0F172A">Hi ${dto.owner_first_name}, verify your email</h2>
  //         <p style="color:#475569">Thanks for registering <strong>${dto.school_name}</strong> on Eduvia.</p>
  //         <p style="color:#475569">Click the button below to verify your email and continue your registration.</p>
  //         <a href="${verifyUrl}" style="display:inline-block;background:#1E3A8A;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
  //           Verify Email Address
  //         </a>
  //         <p style="color:#94A3B8;font-size:13px">This link expires in 24 hours. If you did not register, ignore this email.</p>
  //       </div>
  //     </div>
  //   `;
  // }

  // private buildApprovalEmail(reg: any, identifier: string) {
  //   const loginUrl = `${process.env.FRONTEND_URL}/app/${reg.slug}/sign-in`;
  //   return `
  //     <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto">
  //       <div style="background:#1E3A8A;padding:32px;text-align:center;border-radius:12px 12px 0 0">
  //         <h1 style="color:white;margin:0">🎓 Welcome to Eduvia!</h1>
  //       </div>
  //       <div style="background:white;padding:32px;border:1px solid #E2E8F0;border-radius:0 0 12px 12px">
  //         <h2 style="color:#0F172A">${reg.schoolName} is live!</h2>
  //         <p style="color:#475569">Congratulations ${reg.ownerFirstName}! Your school has been approved.</p>
  //         <div style="background:#EFF6FF;border-radius:8px;padding:20px;margin:20px 0">
  //           <p style="margin:0 0 8px;color:#1E3A8A;font-weight:600">Your login details:</p>
  //           <p style="margin:4px 0;color:#475569">Login ID: <strong style="font-family:monospace">${identifier}</strong></p>
  //           <p style="margin:4px 0;color:#475569">Password: <strong>Your email address (change immediately)</strong></p>
  //           <p style="margin:4px 0;color:#475569">Your school URL: <strong>${reg.slug}.eduvia.com</strong></p>
  //         </div>
  //         <a href="${loginUrl}" style="display:inline-block;background:#1E3A8A;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600">
  //           Go to Your Dashboard
  //         </a>
  //       </div>
  //     </div>
  //   `;
  // }

  // private buildRejectionEmail(reg: SchoolRegistration, reason: string) {
  //   return `
  //     <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto">
  //       <div style="background:#1E3A8A;padding:32px;text-align:center;border-radius:12px 12px 0 0">
  //         <h1 style="color:white;margin:0">Eduvia</h1>
  //       </div>
  //       <div style="background:white;padding:32px;border:1px solid #E2E8F0;border-radius:0 0 12px 12px">
  //         <h2 style="color:#0F172A">Update on your application</h2>
  //         <p style="color:#475569">Hi ${reg.owner_first_name}, unfortunately we were unable to approve the registration for <strong>${reg.school_name}</strong>.</p>
  //         <div style="background:#FEE2E2;border-radius:8px;padding:16px;margin:16px 0">
  //           <p style="color:#991B1B;margin:0"><strong>Reason:</strong> ${reason}</p>
  //         </div>
  //         <p style="color:#475569">If you believe this is an error or would like to appeal, please contact us at support@eduvia.com</p>
  //       </div>
  //     </div>
  //   `;
  // }
}
