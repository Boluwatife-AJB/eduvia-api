import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TenantMiddleware } from './tenant.middleware';
import { ClsModule, ClsMiddleware } from 'nestjs-cls';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';

@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        // We mount the middleware manually so we can control ordering
        mount: false,
        generateId: true,
      },
    }),
  ],
  providers: [TenantMiddleware, TenantService],
  exports: [ClsModule],
  controllers: [TenantController],
})
export class TenantModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Only mount ClsMiddleware for async context; tenant resolution is in TenantGuard
    consumer.apply(ClsMiddleware).forRoutes('*path');
  }
}
