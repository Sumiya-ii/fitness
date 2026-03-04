import { Module } from '@nestjs/common';
import { WeeklySummaryController } from './weekly-summary.controller';
import { WeeklySummaryService } from './weekly-summary.service';

@Module({
  controllers: [WeeklySummaryController],
  providers: [WeeklySummaryService],
  exports: [WeeklySummaryService],
})
export class WeeklySummaryModule {}
