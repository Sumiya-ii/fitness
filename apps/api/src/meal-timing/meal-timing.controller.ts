import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { MealTimingService } from './meal-timing.service';

@Controller('insights/meal-timing')
export class MealTimingController {
  constructor(private readonly mealTimingService: MealTimingService) {}

  @Get()
  async getMealTimingInsights(
    @CurrentUser() user: AuthenticatedUser,
    @Query('week') week?: string,
  ) {
    return {
      data: await this.mealTimingService.getInsights(user.id, week),
    };
  }
}
