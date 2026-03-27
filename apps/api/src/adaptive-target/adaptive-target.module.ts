import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { QUEUE_NAMES } from '@coach/shared';
import { AdaptiveTargetService } from './adaptive-target.service';
import { AdaptiveTargetCron } from './adaptive-target.cron';
import { ObservabilityModule } from '../observability';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.registerQueue({ name: QUEUE_NAMES.ADAPTIVE_TARGET }),
    ObservabilityModule,
  ],
  providers: [AdaptiveTargetService, AdaptiveTargetCron],
})
export class AdaptiveTargetModule {}
