import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MealTimingService } from './meal-timing.service';
import { SentryProvider } from '../observability';

@Injectable()
export class MealTimingCron {
  private readonly logger = new Logger(MealTimingCron.name);

  constructor(
    private readonly mealTimingService: MealTimingService,
    private readonly sentry: SentryProvider,
  ) {}

  // Monday 01:15 UTC = Monday 09:15 Asia/Ulaanbaatar (staggered 15 min from weekly-report at 01:00)
  @Cron('15 1 * * 1')
  async handleMealTimingInsights() {
    try {
      const count = await this.mealTimingService.scheduleMealTimingInsights();
      if (count > 0) {
        this.logger.log(`Enqueued ${count} meal-timing insight job(s)`);
      }
    } catch (error) {
      this.logger.error('Failed to schedule meal timing insights', error);
      this.sentry.captureException(error);
    }
  }
}
