import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
// import * as compression from 'compression';
import { HttpException, Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Security Headers: Adds headers like X-Frame-Options, X-XSS-Protection, etc.
  app.use(helmet());

  // Response Compression: Compresses responses to reduce bandwidth.
  // app.use(compression());

  // CORS: Allows requests from other domains.
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  });

  // Global Prefix: Adds a prefix to all routes.
  app.setGlobalPrefix('api/v1');

  // Validation Pipe: Validates the request body.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const messages = errors.flatMap((e) =>
          Object.values(e.constraints ?? {}),
        );
        const err = new HttpException(
          { message: messages, error: 'Validation Error' },
          422,
        );
        return err;
      },
    }),
  );

  // Swagger: API documentation.
  const config = new DocumentBuilder()
    .setTitle('Eduvia API')
    .setDescription('Eduvia School Management System API')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-tenant-slug',
        description:
          'The school slug (e.g. greenfield). Required for all school-level routes.',
      },
      'x-tenant-slug',
    )
    .addServer(`http://localhost:${process.env.PORT}`, 'Local Development')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Make x-tenant-slug appear in every endpoint automatically
  Object.values(document.paths).forEach((path: Record<string, unknown>) => {
    Object.values(path).forEach((method: unknown) => {
      if (
        typeof method === 'object' &&
        method !== null &&
        'security' in method
      ) {
        const methodObj = method as Record<string, unknown>;
        const existingSecurity = Array.isArray(methodObj.security)
          ? (methodObj.security as unknown[])
          : [];
        methodObj.security = [
          ...existingSecurity,
          {
            'x-tenant-slug': [],
          },
        ];
      }
    });
  });
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  logger.log(
    `Swagger documentation: http://localhost:${process.env.PORT}/api/docs`,
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Eduvia API is running on port ${port}`);
}
bootstrap();
