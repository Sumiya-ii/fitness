import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDailyDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query('date') date?: string,
  ) {
    return { data: await this.dashboardService.getDailyDashboard(user.id, date) };
  }
}
