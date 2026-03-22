import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CoachMemoryService } from './coach-memory.service';
import { CoachMemoryCron } from './coach-memory.cron';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [CoachMemoryService, CoachMemoryCron],
  exports: [CoachMemoryService],
})
export class CoachMemoryModule {}
