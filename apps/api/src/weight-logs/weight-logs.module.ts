import { Module } from '@nestjs/common';
import { WeightLogsController } from './weight-logs.controller';
import { WeightLogsService } from './weight-logs.service';

@Module({
  controllers: [WeightLogsController],
  providers: [WeightLogsService],
  exports: [WeightLogsService],
})
export class WeightLogsModule {}
