import { Cron } from '@nestjs/schedule';
import { Injectable } from '@nestjs/common';
import { WeeklyReportService } from './weekly-report.service';

@Injectable()
export class WeeklyReportCron {
  constructor(private readonly weeklyReportService: WeeklyReportService) {}

  // Run every 15 minutes; service filters to Monday 9–10 AM per user timezone
  @Cron('*/15 * * * *')
  async handleWeeklyReports() {
    const count = await this.weeklyReportService.scheduleWeeklyReports();
    if (count > 0) {
      console.log(`[WeeklyReportCron] Enqueued ${count} weekly report job(s)`);
    }
  }
}
