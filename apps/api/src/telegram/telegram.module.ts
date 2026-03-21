import { Module } from '@nestjs/common';
import { ConfigModule } from '../config';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { TelegramBotService } from './telegram-bot.service';
import { IdempotencyService } from './idempotency.service';
import { TelegramFoodParserService } from './telegram-food-parser.service';
import { ChatModule } from '../chat';
import { MealLogsModule } from '../meal-logs/meal-logs.module';

@Module({
  imports: [ConfigModule, ChatModule, MealLogsModule],
  controllers: [TelegramController],
  providers: [TelegramService, TelegramBotService, IdempotencyService, TelegramFoodParserService],
  exports: [TelegramService, IdempotencyService],
})
export class TelegramModule {}
