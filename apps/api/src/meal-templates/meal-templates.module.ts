import { Module } from '@nestjs/common';
import { MealTemplatesController } from './meal-templates.controller';
import { MealTemplatesService } from './meal-templates.service';

@Module({
  controllers: [MealTemplatesController],
  providers: [MealTemplatesService],
  exports: [MealTemplatesService],
})
export class MealTemplatesModule {}
