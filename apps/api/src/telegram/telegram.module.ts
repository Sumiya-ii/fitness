import { Module } from '@nestjs/common';
import { ConfigModule } from '../config';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { TelegramBotService } from './telegram-bot.service';
import { IdempotencyService } from './idempotency.service';
import { ChatModule } from '../chat';

@Module({
  imports: [ConfigModule, ChatModule],
  controllers: [TelegramController],
  providers: [TelegramService, TelegramBotService, IdempotencyService],
  exports: [TelegramService, IdempotencyService],
})
export class TelegramModule {}
