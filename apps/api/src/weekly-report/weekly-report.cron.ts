import { Cron } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { WeeklyReportService } from './weekly-report.service';
import { SentryProvider } from '../observability';

@Injectable()
export class WeeklyReportCron {
  private readonly logger = new Logger(WeeklyReportCron.name);

  constructor(
    private readonly weeklyReportService: WeeklyReportService,
    private readonly sentry: SentryProvider,
  ) {}

  // Monday 01:00 UTC = Monday 09:00 Asia/Ulaanbaatar
  @Cron('0 1 * * 1')
  async handleWeeklyReports() {
    try {
      const count = await this.weeklyReportService.scheduleWeeklyReports();
      if (count > 0) {
        this.logger.log(`Enqueued ${count} weekly report job(s)`);
      }
    } catch (error) {
      this.logger.error('Failed to schedule weekly reports', error);
      this.sentry.captureException(error);
    }
  }
}
