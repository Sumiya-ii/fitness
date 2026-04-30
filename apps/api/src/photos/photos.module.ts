import { Module } from '@nestjs/common';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { PhotoParserService } from './photo-parser.service';
import { PhotoDailyQuotaGuard } from './photo-daily-quota.guard';
import { SubscriptionsModule } from '../subscriptions';
import { ConfigModule } from '../config';

@Module({
  imports: [SubscriptionsModule, ConfigModule],
  controllers: [PhotosController],
  providers: [PhotosService, PhotoParserService, PhotoDailyQuotaGuard],
  exports: [PhotosService, PhotoParserService],
})
export class PhotosModule {}
