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

  @Cron('*/15 * * * *') // Every 15 minutes — filters to 8–9 PM window inside the service
  async handleMealNudges() {
    try {
      await this.mealNudgeService.scheduleMealNudges();
    } catch (error) {
      this.logger.error('Failed to schedule meal nudges', error);
      this.sentry.captureException(error);
    }
  }
}
