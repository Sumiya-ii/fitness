import { Module } from '@nestjs/common';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { PhotoParserService } from './photo-parser.service';
import { SubscriptionsModule } from '../subscriptions';

@Module({
  imports: [SubscriptionsModule],
  controllers: [PhotosController],
  providers: [PhotosService, PhotoParserService],
  exports: [PhotosService, PhotoParserService],
})
export class PhotosModule {}
