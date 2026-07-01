import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { DashboardModule } from '../dashboard';
import { CoachMemoryModule } from '../coach-memory/coach-memory.module';
import { PrismaModule } from '../prisma';

@Module({
  imports: [DashboardModule, CoachMemoryModule, PrismaModule],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
