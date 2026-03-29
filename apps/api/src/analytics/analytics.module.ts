import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsCleanupService } from './analytics-cleanup.service';
import { ObservabilityModule } from '../observability';

@Global()
@Module({
  imports: [ScheduleModule.forRoot(), ObservabilityModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsCleanupService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
