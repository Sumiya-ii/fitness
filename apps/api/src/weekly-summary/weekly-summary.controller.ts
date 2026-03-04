import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { WeeklySummaryService } from './weekly-summary.service';

@Controller('weekly-summary')
export class WeeklySummaryController {
  constructor(private readonly weeklySummaryService: WeeklySummaryService) {}

  @Get()
  async getWeeklySummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('week') week?: string,
  ) {
    return {
      data: await this.weeklySummaryService.getWeeklySummary(user.id, week),
    };
  }
}
