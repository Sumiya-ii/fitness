import { Module } from '@nestjs/common';
import { QPayController } from './qpay.controller';
import { QPayService } from './qpay.service';
import { SubscriptionsModule } from '../subscriptions';

@Module({
  imports: [SubscriptionsModule],
  controllers: [QPayController],
  providers: [QPayService],
  exports: [QPayService],
})
export class QPayModule {}
