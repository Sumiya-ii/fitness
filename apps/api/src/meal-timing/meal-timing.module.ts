import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { QUEUE_NAMES } from '@coach/shared';
import { MealTimingService } from './meal-timing.service';
import { MealTimingController } from './meal-timing.controller';
import { MealTimingCron } from './meal-timing.cron';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.registerQueue({ name: QUEUE_NAMES.MEAL_TIMING_INSIGHTS }),
  ],
  controllers: [MealTimingController],
  providers: [MealTimingService, MealTimingCron],
})
export class MealTimingModule {}
