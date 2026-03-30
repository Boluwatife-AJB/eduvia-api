import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthController } from './auth/auth.controller';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { validationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { ErrorsModule } from './errors/errors.module';
import { LecturesController } from './lectures/lectures.controller';
import { LecturesModule } from './lectures/lectures.module';
import { LecturesService } from './lectures/lectures.service';
import { RepositoryController } from './repository/repository.controller';
import { SchoolSetupController } from './school-setup/school-setup.controller';
import { SchoolSetupModule } from './school-setup/school-setup.module';
import { TenantModule } from './tenant/tenant.module';
import { TimetableController } from './timetable/timetable.controller';
import { TimetableModule } from './timetable/timetable.module';
import { TimetableService } from './timetable/timetable.service';
import { UploadController } from './upload/upload.controller';
import { UploadModule } from './upload/upload.module';
import { UploadService } from './upload/upload.service';
import { UsersController } from './users/users.controller';
import { UsersModule } from './users/users.module';
import { UsersService } from './users/users.service';
import { OnboardingController } from './onboarding/onboarding.controller';
import { OnboardingModule } from './onboarding/onboarding.module';
import { OnboardingService } from './onboarding/onboarding.service';
import { RepositoryAccessService } from './repository/repository-access.service';
import { RepositoryFileService } from './repository/repository-file.service';
import { RepositoryFolderService } from './repository/repository-folder.service';
import { RepositoryQuotaService } from './repository/repository-quota.service';
import { RepositoryModule } from './repository/repository.module';
import { TenantGuard } from './tenant/tenant.guard';
import { AssessmentService } from './assessment/assessment.service';
import { QueueModule } from './queue/queue.module';
import { EmailService } from './email/email.service';
import { GradingService } from './assessment/grading.service';
import { NotificationsService } from './notifications/notifications.service';
import { NotificationsController } from './notifications/notifications.controller';
import { SchoolConfigService } from './school-config/school-config.service';
import { SchoolConfigController } from './school-config/school-config.controller';
import { ApprovalModule } from './approval/approval.module';
import { ResultEngineService } from './result-engine/result-engine.service';
import { AssessmentController } from './assessment/assessment.controller';
import { GpaCalculatorService } from './assessment/gpa-calculator.service';
import { SchoolConfigModule } from './school-config/school-config.module';
import { AssessmentModule } from './assessment/assessment.module';
import { NotificationsModule } from './notifications/notifications.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    // Config loads env variables and validates them
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
    }),

    // Rate limiting - 100 requests per minute per IP address
    ThrottlerModule.forRoot([
      {
        ttl: 60 * 1000, // 1 minute
        limit: 100, // 100 requests per minute per IP address
      },
    ]),

    // Modules
    ErrorsModule,
    DatabaseModule, // Prisma global module
    AuthModule, // Multi-tenancy via CLS - globally
    TenantModule, // JWT auth, login, refresh, logout, etc.
    UsersModule, // Users module
    SchoolSetupModule, // School setup module
    TimetableModule,
    LecturesModule,
    UploadModule,
    RepositoryModule,
    OnboardingModule,
    QueueModule,
    ApprovalModule,
    SchoolConfigModule,
    AssessmentModule,
    NotificationsModule,
    EmailModule,
  ],
  controllers: [
    AppController,
    AuthController,
    UsersController,
    SchoolSetupController,
    TimetableController,
    LecturesController,
    UploadController,
    RepositoryController,
    OnboardingController,
    NotificationsController,
    SchoolConfigController,
    AssessmentController,
  ],
  providers: [
    AppService,
    // Apply rate limiting to all routes
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    // Apply JWT authentication to all routes except decorators with @Public()
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },

    // Apply roles guard to all routes except decorators with @Public()
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },

    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },

    UsersService,

    TimetableService,

    LecturesService,

    UploadService,

    RepositoryAccessService,

    RepositoryQuotaService,

    RepositoryFileService,

    RepositoryFolderService,

    OnboardingService,

    AssessmentService,

    EmailService,

    GradingService,

    NotificationsService,

    SchoolConfigService,

    ResultEngineService,

    GpaCalculatorService,

    // SchoolSetupService,
  ],
})
export class AppModule {}
