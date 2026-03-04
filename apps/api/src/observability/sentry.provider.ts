import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { ConfigService } from '../config';

export type SentrySeverityLevel =
  | 'fatal'
  | 'error'
  | 'warning'
  | 'log'
  | 'info'
  | 'debug';

@Injectable()
export class SentryProvider implements OnModuleInit {
  private readonly logger = new Logger(SentryProvider.name);
  private initialized = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const dsn = this.config.get('SENTRY_DSN');
    if (!dsn) {
      this.logger.warn(
        'Sentry not configured (SENTRY_DSN missing). Error reporting disabled.',
      );
      return;
    }

    Sentry.init({
      dsn,
      environment: this.config.get('NODE_ENV'),
    });
    this.initialized = true;
    this.logger.log('Sentry initialized');
  }

  get isAvailable(): boolean {
    return this.initialized;
  }

  captureException(error: unknown): string | undefined {
    if (!this.initialized) return undefined;
    return Sentry.captureException(error);
  }

  captureMessage(
    message: string,
    level: SentrySeverityLevel = 'info',
  ): string | undefined {
    if (!this.initialized) return undefined;
    return Sentry.captureMessage(message, level);
  }
}
