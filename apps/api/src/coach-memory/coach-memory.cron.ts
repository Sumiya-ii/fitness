import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CoachMemoryService } from './coach-memory.service';
import { SentryProvider } from '../observability';

@Injectable()
export class CoachMemoryCron {
  private readonly logger = new Logger(CoachMemoryCron.name);

  constructor(
    private readonly coachMemoryService: CoachMemoryService,
    private readonly sentry: SentryProvider,
  ) {}

  /**
   * Every Sunday at 02:00 UTC (= 10:00 Asia/Ulaanbaatar).
   * Enqueues one memory-refresh job per user so the worker
   * regenerates GPT summaries over their last 30 days of data.
   */
  @Cron('0 2 * * 0')
  async handleWeeklyMemoryRefresh(): Promise<void> {
    try {
      const count = await this.coachMemoryService.scheduleRefresh();
      if (count > 0) {
        this.logger.log(`Enqueued memory refresh for ${count} user(s)`);
      }
    } catch (error) {
      this.logger.error('Failed to schedule memory refresh', error);
      this.sentry.captureException(error);
    }
  }
}
