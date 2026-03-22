import { Cron } from '@nestjs/schedule';
import { Injectable } from '@nestjs/common';
import { WeeklyReportService } from './weekly-report.service';

@Injectable()
export class WeeklyReportCron {
  constructor(private readonly weeklyReportService: WeeklyReportService) {}

  // Monday 01:00 UTC = Monday 09:00 Asia/Ulaanbaatar
  @Cron('0 1 * * 1')
  async handleWeeklyReports() {
    const count = await this.weeklyReportService.scheduleWeeklyReports();
    if (count > 0) {
      console.log(`[WeeklyReportCron] Enqueued ${count} weekly report job(s)`);
    }
  }
}
