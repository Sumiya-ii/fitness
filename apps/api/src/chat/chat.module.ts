import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { DashboardModule } from '../dashboard';

@Module({
  imports: [DashboardModule],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
