import { Module } from '@nestjs/common';
import { WaterLogsController } from './water-logs.controller';
import { WaterLogsService } from './water-logs.service';

@Module({
  controllers: [WaterLogsController],
  providers: [WaterLogsService],
  exports: [WaterLogsService],
})
export class WaterLogsModule {}
