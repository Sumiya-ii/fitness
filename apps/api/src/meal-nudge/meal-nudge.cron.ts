import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MealNudgeService } from './meal-nudge.service';
import { SentryProvider } from '../observability';

@Injectable()
export class MealNudgeCron {
  private readonly logger = new Logger(MealNudgeCron.name);

  constructor(
    private readonly mealNudgeService: MealNudgeService,
    private readonly sentry: SentryProvider,
  ) {}

  // Runs at :07, :22, :37, :52 every hour (staggered 7 min from coach at :00) — filters to 8–9 PM window inside the service
  @Cron('7,22,37,52 * * * *')
  async handleMealNudges() {
    try {
      await this.mealNudgeService.scheduleMealNudges();
    } catch (error) {
      this.logger.error('Failed to schedule meal nudges', error);
      this.sentry.captureException(error);
    }
  }
}
