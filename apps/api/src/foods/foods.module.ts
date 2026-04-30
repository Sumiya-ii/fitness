import { Module } from '@nestjs/common';
import { FoodsController } from './foods.controller';
import { FoodsService } from './foods.service';
import { AdminGuard } from '../admin/admin.guard';
import { ConfigModule } from '../config';

@Module({
  imports: [ConfigModule],
  controllers: [FoodsController],
  providers: [FoodsService, AdminGuard],
  exports: [FoodsService],
})
export class FoodsModule {}
