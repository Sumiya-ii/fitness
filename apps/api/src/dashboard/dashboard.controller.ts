import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDailyDashboard(@CurrentUser() user: AuthenticatedUser, @Query('date') date?: string) {
    return { data: await this.dashboardService.getDailyDashboard(user.id, date) };
  }

  @Get('history')
  async getNutritionHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
  ) {
    const clampedDays = Math.min(90, Math.max(7, days));
    return { data: await this.dashboardService.getHistory(user.id, clampedDays) };
  }
}
