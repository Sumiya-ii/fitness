import { Module } from '@nestjs/common';
import { FoodsController } from './foods.controller';
import { FoodsService } from './foods.service';
import { AdminGuard } from '../admin/admin.guard';

@Module({
  controllers: [FoodsController],
  providers: [FoodsService, AdminGuard],
  exports: [FoodsService],
})
export class FoodsModule {}
