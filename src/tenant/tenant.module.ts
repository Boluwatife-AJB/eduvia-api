import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TenantMiddleware } from './tenant.middleware';
import { ClsModule, ClsMiddleware } from 'nestjs-cls';

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
  providers: [TenantMiddleware],
  exports: [ClsModule],
})
export class TenantModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // ClsMiddleware must run before TenantMiddleware so CLS context exists
    consumer.apply(ClsMiddleware, TenantMiddleware).forRoutes('*path');
  }
}
