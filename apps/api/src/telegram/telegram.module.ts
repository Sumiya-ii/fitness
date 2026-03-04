import { Module } from '@nestjs/common';
import { ConfigModule } from '../config';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { TelegramBotService } from './telegram-bot.service';
import { IdempotencyService } from './idempotency.service';
import { MealLogsModule } from '../meal-logs';

@Module({
  imports: [ConfigModule, MealLogsModule],
  controllers: [TelegramController],
  providers: [TelegramService, TelegramBotService, IdempotencyService],
  exports: [TelegramService, IdempotencyService],
})
export class TelegramModule {}
