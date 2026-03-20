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
import { SchoolSetupController } from './school-setup/school-setup.controller';
import { SchoolSetupModule } from './school-setup/school-setup.module';
import { TenantModule } from './tenant/tenant.module';
import { UsersController } from './users/users.controller';
import { UsersModule } from './users/users.module';
import { UsersService } from './users/users.service';
import { TimetableService } from './timetable/timetable.service';
import { TimetableController } from './timetable/timetable.controller';
import { TimetableModule } from './timetable/timetable.module';
import { StorageService } from './storage/storage.service';
import { StorageModule } from './storage/storage.module';
import { LecturesService } from './lectures/lectures.service';
import { LecturesController } from './lectures/lectures.controller';
import { LecturesModule } from './lectures/lectures.module';
import { UploadService } from './upload/upload.service';
import { UploadController } from './upload/upload.controller';
import { UploadModule } from './upload/upload.module';

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
    StorageModule, // Storage module
    UsersModule, // Users module
    SchoolSetupModule, // School setup module
    TimetableModule,
    LecturesModule,
    UploadModule, // Lectures module
  ],
  controllers: [
    AppController,
    AuthController,
    UsersController,
    SchoolSetupController,
    TimetableController,
    LecturesController,
    UploadController,
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

    UsersService,

    TimetableService,

    StorageService,

    LecturesService,

    UploadService,

    // SchoolSetupService,
  ],
})
export class AppModule {}
