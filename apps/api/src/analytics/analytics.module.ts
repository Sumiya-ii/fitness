import { Global, Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsCleanupService } from './analytics-cleanup.service';
import { ObservabilityModule } from '../observability';

@Global()
@Module({
  imports: [ObservabilityModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsCleanupService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
