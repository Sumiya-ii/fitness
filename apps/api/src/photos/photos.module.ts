import { Module } from '@nestjs/common';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { PhotoParserService } from './photo-parser.service';

@Module({
  controllers: [PhotosController],
  providers: [PhotosService, PhotoParserService],
  exports: [PhotosService, PhotoParserService],
})
export class PhotosModule {}
