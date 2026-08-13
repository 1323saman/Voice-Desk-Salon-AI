import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';

@Catch()
export class SentryExceptionFilter
  implements ExceptionFilter
{
  catch(exception: unknown, host: ArgumentsHost) {
    Sentry.captureException(exception);

    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : 500;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
    });
  }
}