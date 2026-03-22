import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WeeklyReportService } from './weekly-report.service';
import { WeeklyReportCron } from './weekly-report.cron';
import { CoachMemoryModule } from '../coach-memory/coach-memory.module';

@Module({
  imports: [ScheduleModule.forRoot(), CoachMemoryModule],
  providers: [WeeklyReportService, WeeklyReportCron],
})
export class WeeklyReportModule {}
