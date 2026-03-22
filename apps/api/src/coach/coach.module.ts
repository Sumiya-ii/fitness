import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CoachService } from './coach.service';
import { CoachCron } from './coach.cron';
import { CoachContextService } from './coach-context.service';
import { CoachMemoryModule } from '../coach-memory/coach-memory.module';

@Module({
  imports: [ScheduleModule.forRoot(), CoachMemoryModule],
  providers: [CoachContextService, CoachService, CoachCron],
  exports: [CoachService, CoachContextService],
})
export class CoachModule {}
