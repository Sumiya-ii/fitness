import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CoachService } from './coach.service';
import { CoachCron } from './coach.cron';
import { CoachContextService } from './coach-context.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [CoachContextService, CoachService, CoachCron],
  exports: [CoachService, CoachContextService],
})
export class CoachModule {}
