import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma';
import { SentryProvider } from '../observability';

@Injectable()
export class AnalyticsCleanupService {
  private readonly logger = new Logger(AnalyticsCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sentry: SentryProvider,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanupOldAnalyticsEvents(): Promise<void> {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const result = await this.prisma.analyticsEvent.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      if (result.count > 0) {
        this.logger.log(`Cleaned up ${result.count} analytics events older than 90 days`);
      }
    } catch (err) {
      this.logger.error('Failed to clean up old analytics events', err);
      this.sentry.captureException(err);
    }
  }
}
