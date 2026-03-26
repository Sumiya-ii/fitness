import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { DashboardModule } from '../dashboard';
import { SubscriptionsModule } from '../subscriptions';

@Module({
  imports: [DashboardModule, SubscriptionsModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
