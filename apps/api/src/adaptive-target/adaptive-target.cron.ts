import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AdaptiveTargetService } from './adaptive-target.service';
import { SentryProvider } from '../observability';

@Injectable()
export class AdaptiveTargetCron {
  private readonly logger = new Logger(AdaptiveTargetCron.name);

  constructor(
    private readonly adaptiveTargetService: AdaptiveTargetService,
    private readonly sentry: SentryProvider,
  ) {}

  /**
   * Run every Sunday at 01:00 UTC (= 09:00 Asia/Ulaanbaatar).
   * Compares each user's actual weight trend against their goal and adjusts
   * their calorie target accordingly.
   */
  @Cron('0 1 * * 0')
  async handleWeeklyAdjustments(): Promise<void> {
    try {
      const count = await this.adaptiveTargetService.runWeeklyAdjustments();
      if (count > 0) {
        this.logger.log(`Adjusted calorie targets for ${count} user(s)`);
      }
    } catch (error) {
      this.logger.error('Failed to run weekly target adjustments', error);
      this.sentry.captureException(error);
    }
  }
}
