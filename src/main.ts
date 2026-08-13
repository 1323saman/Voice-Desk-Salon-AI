import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SentryExceptionFilter } from './common/filters/sentry-exception.filter';

import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';

import { ValidationPipe } from '@nestjs/common';

import * as Sentry from '@sentry/node';

import {
  NestExpressApplication,
} from '@nestjs/platform-express';

import { join } from 'path';

async function bootstrap() {
  /*
   * Create the NestJS application.
   *
   * NestExpressApplication is used so we can
   * serve the microphone test page from /public.
   */
  const app =
    await NestFactory.create<NestExpressApplication>(
      AppModule,
    );

  /*
   * Serve static files from the public folder.
   *
   * Example:
   *
   * public/voice-test.html
   *
   * becomes:
   *
   * http://localhost:3000/voice-test.html
   */
  app.useStaticAssets(
    join(__dirname, '..', 'public'),
  );

  /*
   * Initialize Sentry.
   */
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment:
      process.env.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
  });

  /*
   * Global validation.
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  /*
   * Global Sentry exception handling.
   */
  app.useGlobalFilters(
    new SentryExceptionFilter(),
  );

  /*
   * Swagger configuration.
   */
  const config =
    new DocumentBuilder()
      .setTitle('AI Front Desk API')
      .setDescription(
        'AI-powered virtual receptionist for salons and spas',
      )
      .setVersion('1.0')
      .build();

  const document =
    SwaggerModule.createDocument(
      app,
      config,
    );

  SwaggerModule.setup(
    'api',
    app,
    document,
  );

  /*
   * Start server.
   */
  await app.listen(3000);

  console.log('');
  console.log('======================================');
  console.log('AI FRONT DESK SERVER');
  console.log('======================================');

  console.log(
    'Application: http://localhost:3000',
  );

  console.log(
    'Swagger:     http://localhost:3000/api',
  );

  console.log(
    'Voice Test:  http://localhost:3000/voice-test.html',
  );

  console.log('======================================');
  console.log('');
}

bootstrap();