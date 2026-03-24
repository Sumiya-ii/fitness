import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MealNudgeService } from './meal-nudge.service';
import { MealNudgeCron } from './meal-nudge.cron';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [MealNudgeService, MealNudgeCron],
  exports: [MealNudgeService],
})
export class MealNudgeModule {}
