import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '../config';
import { SentryProvider } from './sentry.provider';
import { RequestIdMiddleware } from './request-id.middleware';
import { RequestLoggerMiddleware } from './request-logger.middleware';
import { AllExceptionsFilter } from './all-exceptions.filter';

@Module({
  imports: [ConfigModule],
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
    consumer.apply(RequestIdMiddleware, RequestLoggerMiddleware).forRoutes('*');
  }
}
