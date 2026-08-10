import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import * as Sentry from '@sentry/node';

async function bootstrap() {
  // Load NestJS application first so ConfigModule loads .env.
  const app = await NestFactory.create(AppModule);

  // Initialize Sentry after environment variables are available.
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('AI Front Desk API')
    .setDescription(
      'AI-powered virtual receptionist for salons and spas',
    )
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(
    app,
    config,
  );

  SwaggerModule.setup('api', app, document);

  await app.listen(3000);

  console.log(
    'Application running on http://localhost:3000',
  );

  console.log(
    'Swagger docs at http://localhost:3000/api',
  );
}

bootstrap();