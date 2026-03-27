import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CoachMemoryService } from './coach-memory.service';
import { CoachMemoryCron } from './coach-memory.cron';
import { ObservabilityModule } from '../observability';

@Module({
  imports: [ScheduleModule.forRoot(), ObservabilityModule],
  providers: [CoachMemoryService, CoachMemoryCron],
  exports: [CoachMemoryService],
})
export class CoachMemoryModule {}
