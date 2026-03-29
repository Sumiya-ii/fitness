import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '../config';
import { SentryProvider } from './sentry.provider';
import { RequestIdMiddleware } from './request-id.middleware';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { IncomingMessage } from 'http';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get('NODE_ENV') === 'production';
        return {
          pinoHttp: {
            level: isProduction ? 'info' : 'debug',
            transport: isProduction
              ? undefined
              : { target: 'pino-pretty', options: { colorize: true } },
            genReqId: (req: IncomingMessage) => (req as any).requestId,
            customProps: (req: IncomingMessage) => ({
              requestId: (req as any).requestId,
              userId: (req as any).user?.uid,
            }),
            redact: ['req.headers.authorization', 'req.headers.cookie'],
            serializers: {
              req: (req: any) => ({
                id: req.id,
                method: req.method,
                url: req.url,
                query: req.query,
                params: req.params,
              }),
              res: (res: any) => ({
                statusCode: res.statusCode,
              }),
            },
            customLogLevel: (_req: IncomingMessage, res: any, err: unknown) => {
              if (res.statusCode >= 500 || err) return 'error';
              if (res.statusCode >= 400) return 'warn';
              return 'info';
            },
            customSuccessMessage: (req: IncomingMessage, res: any, responseTime: number) => {
              return `${(req as any).method} ${(req as any).url} ${res.statusCode} ${Math.round(responseTime)}ms`;
            },
            customErrorMessage: (req: IncomingMessage, res: any, err: Error) => {
              return `${(req as any).method} ${(req as any).url} ${res.statusCode} ${err.message}`;
            },
            // Skip health check noise
            autoLogging: {
              ignore: (req: IncomingMessage) => (req as any).url === '/api/v1/health',
            },
          },
        };
      },
    }),
  ],
  providers: [
    SentryProvider,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
  exports: [SentryProvider],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // RequestIdMiddleware runs first so pino can pick up the ID
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
