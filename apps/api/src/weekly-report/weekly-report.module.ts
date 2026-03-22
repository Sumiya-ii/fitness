import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WeeklyReportService } from './weekly-report.service';
import { WeeklyReportCron } from './weekly-report.cron';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [WeeklyReportService, WeeklyReportCron],
})
export class WeeklyReportModule {}
