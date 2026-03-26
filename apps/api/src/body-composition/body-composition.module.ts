import { Module } from '@nestjs/common';
import { BodyCompositionController } from './body-composition.controller';
import { BodyCompositionService } from './body-composition.service';

@Module({
  controllers: [BodyCompositionController],
  providers: [BodyCompositionService],
  exports: [BodyCompositionService],
})
export class BodyCompositionModule {}
