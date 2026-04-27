import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';
import { VoiceCleanupService } from './voice-cleanup.service';
import { VoiceRateLimitService } from './voice-rate-limit.service';
import { ObservabilityModule } from '../observability';

@Module({
  imports: [ScheduleModule.forRoot(), ObservabilityModule],
  controllers: [VoiceController],
  providers: [VoiceService, VoiceCleanupService, VoiceRateLimitService],
  exports: [VoiceService],
})
export class VoiceModule {}
