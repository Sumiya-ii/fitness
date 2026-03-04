import { Module } from '@nestjs/common';
import { ProfileModule } from '../profile';
import { TargetsController } from './targets.controller';
import { TargetsService } from './targets.service';

@Module({
  imports: [ProfileModule],
  controllers: [TargetsController],
  providers: [TargetsService],
  exports: [TargetsService],
})
export class TargetsModule {}
