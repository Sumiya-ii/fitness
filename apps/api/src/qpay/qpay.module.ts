// QPay mobile UI integration is planned for v2.
// Backend is fully implemented (invoice creation, callbacks, status checks).
// Mobile SubscriptionScreen needs QPay payment flow for Mongolian bank users.
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
