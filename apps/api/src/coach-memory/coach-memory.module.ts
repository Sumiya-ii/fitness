import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CoachMemoryService } from './coach-memory.service';
import { CoachMemoryController } from './coach-memory.controller';
// CoachMemoryCron disabled for v1 MVP — re-enable post-App Store launch.
// import { CoachMemoryCron } from './coach-memory.cron';
import { ObservabilityModule } from '../observability';

@Module({
  imports: [ScheduleModule.forRoot(), ObservabilityModule],
  controllers: [CoachMemoryController],
  providers: [CoachMemoryService /* , CoachMemoryCron */],
  exports: [CoachMemoryService],
})
export class CoachMemoryModule {}
