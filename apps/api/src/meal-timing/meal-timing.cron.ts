import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MealTimingService } from './meal-timing.service';

@Injectable()
export class MealTimingCron {
  constructor(private readonly mealTimingService: MealTimingService) {}

  // Run every 15 minutes; service filters to Monday 9–10 AM per user timezone
  @Cron('*/15 * * * *')
  async handleMealTimingInsights() {
    const count = await this.mealTimingService.scheduleMealTimingInsights();
    if (count > 0) {
      console.log(`[MealTimingCron] Enqueued ${count} meal-timing insight job(s)`);
    }
  }
}
