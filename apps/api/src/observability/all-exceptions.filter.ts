import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Request, Response } from 'express';
import { SentryProvider } from './sentry.provider';
import { REQUEST_ID_HEADER } from './request-id.middleware';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly sentry: SentryProvider) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = request.requestId ?? 'unknown';
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : exception instanceof Error
          ? exception.message
          : 'Internal server error';

    this.logger.error(
      `[${requestId}] ${request.method} ${request.url} - ${status}: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    if (this.sentry.isAvailable && status >= 500) {
      Sentry.withScope((scope) => {
        scope.setTag('requestId', requestId);
        scope.setTag('statusCode', String(status));
        scope.setContext('request', {
          method: request.method,
          url: request.url,
          requestId,
        });
        const user = (request as unknown as Record<string, unknown>).user as
          | { id?: string }
          | undefined;
        if (user?.id) {
          scope.setUser({ id: user.id });
        }
        this.sentry.captureException(exception);
      });
    }

    const body =
      exception instanceof HttpException
        ? exception.getResponse()
        : { statusCode: status, message };

    response.setHeader(REQUEST_ID_HEADER, requestId);

    if (response.headersSent) {
      return;
    }

    response.status(status).json({
      ...(typeof body === 'object' && body !== null ? body : { message: body }),
      requestId,
    });
  }
}
