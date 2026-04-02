import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { ConfigService } from '../config';

export type SentrySeverityLevel = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';

@Injectable()
export class SentryProvider implements OnModuleInit {
  private readonly logger = new Logger(SentryProvider.name);
  private initialized = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const dsn = this.config.get('SENTRY_DSN');
    if (!dsn) {
      this.logger.warn('Sentry not configured (SENTRY_DSN missing). Error reporting disabled.');
      return;
    }

    Sentry.init({
      dsn,
      environment: this.config.get('NODE_ENV'),
      sampleRate: 1.0,
    });
    this.initialized = true;
    this.logger.log('Sentry initialized');
  }

  get isAvailable(): boolean {
    return this.initialized;
  }

  captureException(error: unknown): string | undefined {
    if (!this.initialized) {
      this.logger.warn('captureException called but Sentry is not initialized');
      return undefined;
    }
    const eventId = Sentry.captureException(error);
    this.logger.log(`Sentry event captured: ${eventId}`);
    return eventId;
  }

  captureMessage(message: string, level: SentrySeverityLevel = 'info'): string | undefined {
    if (!this.initialized) return undefined;
    return Sentry.captureMessage(message, level);
  }

  setRequestContext(data: {
    method: string;
    url: string;
    requestId: string;
    userId?: string;
  }): void {
    if (!this.initialized) return;
    Sentry.withScope((scope) => {
      scope.setTag('requestId', data.requestId);
      scope.setContext('request', {
        method: data.method,
        url: data.url,
        requestId: data.requestId,
      });
      if (data.userId) {
        scope.setUser({ id: data.userId });
      }
    });
  }

  async close(timeoutMs = 2000): Promise<void> {
    if (!this.initialized) return;
    await Sentry.close(timeoutMs);
    this.initialized = false;
    this.logger.log('Sentry flushed and closed');
  }
}
