import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MealTimingService } from './meal-timing.service';

@Injectable()
export class MealTimingCron {
  constructor(private readonly mealTimingService: MealTimingService) {}

  // Monday 01:00 UTC = Monday 09:00 Asia/Ulaanbaatar
  @Cron('0 1 * * 1')
  async handleMealTimingInsights() {
    const count = await this.mealTimingService.scheduleMealTimingInsights();
    if (count > 0) {
      console.log(`[MealTimingCron] Enqueued ${count} meal-timing insight job(s)`);
    }
  }
}
