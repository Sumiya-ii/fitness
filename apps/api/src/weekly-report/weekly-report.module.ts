import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WeeklyReportService } from './weekly-report.service';
// WeeklyReportCron disabled for v1 MVP — re-enable post-App Store launch.
// import { WeeklyReportCron } from './weekly-report.cron';
import { CoachMemoryModule } from '../coach-memory/coach-memory.module';
import { ObservabilityModule } from '../observability';

@Module({
  imports: [ScheduleModule.forRoot(), CoachMemoryModule, ObservabilityModule],
  providers: [WeeklyReportService /* , WeeklyReportCron */],
})
export class WeeklyReportModule {}
