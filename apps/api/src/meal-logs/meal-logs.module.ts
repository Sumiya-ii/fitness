import { Module } from '@nestjs/common';
import { MealLogsController } from './meal-logs.controller';
import { MealLogsService } from './meal-logs.service';
import { CalibrationService } from './calibration.service';

@Module({
  controllers: [MealLogsController],
  providers: [MealLogsService, CalibrationService],
  exports: [MealLogsService, CalibrationService],
})
export class MealLogsModule {}
