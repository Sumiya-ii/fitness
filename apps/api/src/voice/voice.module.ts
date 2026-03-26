import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';
import { VoiceCleanupService } from './voice-cleanup.service';
import { SubscriptionsModule } from '../subscriptions';

@Module({
  imports: [ScheduleModule.forRoot(), SubscriptionsModule],
  controllers: [VoiceController],
  providers: [VoiceService, VoiceCleanupService],
  exports: [VoiceService],
})
export class VoiceModule {}
