import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CoachService } from './coach.service';
// CoachCron (proactive 15-min coaching messages) disabled for v1 MVP.
// Telegram bot replies reactively via webhook and does not depend on this cron.
// import { CoachCron } from './coach.cron';
import { CoachContextService } from './coach-context.service';
import { CoachMemoryModule } from '../coach-memory/coach-memory.module';
import { ObservabilityModule } from '../observability';

@Module({
  imports: [ScheduleModule.forRoot(), CoachMemoryModule, ObservabilityModule],
  providers: [CoachContextService, CoachService /* , CoachCron */],
  exports: [CoachService, CoachContextService],
})
export class CoachModule {}
