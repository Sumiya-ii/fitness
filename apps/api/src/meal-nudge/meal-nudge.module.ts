import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MealNudgeService } from './meal-nudge.service';
// MealNudgeCron disabled for v1 MVP — re-enable post-App Store launch.
// import { MealNudgeCron } from './meal-nudge.cron';
import { ObservabilityModule } from '../observability';

@Module({
  imports: [ScheduleModule.forRoot(), ObservabilityModule],
  providers: [MealNudgeService /* , MealNudgeCron */],
  exports: [MealNudgeService],
})
export class MealNudgeModule {}
