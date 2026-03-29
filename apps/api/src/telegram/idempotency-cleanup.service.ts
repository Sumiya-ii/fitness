import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma';
import { SentryProvider } from '../observability';

@Injectable()
export class IdempotencyCleanupService {
  private readonly logger = new Logger(IdempotencyCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sentry: SentryProvider,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredIdempotencyKeys(): Promise<void> {
    try {
      const result = await this.prisma.idempotencyKey.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      if (result.count > 0) {
        this.logger.log(`Cleaned up ${result.count} expired idempotency key(s)`);
      }
    } catch (err) {
      this.logger.error('Failed to clean up expired idempotency keys', err);
      this.sentry.captureException(err);
    }
  }
}
