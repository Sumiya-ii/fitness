import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MealNudgeService } from './meal-nudge.service';

@Injectable()
export class MealNudgeCron {
  constructor(private readonly mealNudgeService: MealNudgeService) {}

  @Cron('*/15 * * * *') // Every 15 minutes — filters to 8–9 PM window inside the service
  async handleMealNudges() {
    await this.mealNudgeService.scheduleMealNudges();
  }
}
