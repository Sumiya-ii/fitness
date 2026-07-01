import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { TelegramBotService } from './telegram-bot.service';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyCleanupService } from './idempotency-cleanup.service';
import { TelegramFoodParserService } from './telegram-food-parser.service';
import { ChatModule } from '../chat';
import { MealLogsModule } from '../meal-logs/meal-logs.module';
import { SubscriptionsModule } from '../subscriptions';

@Module({
  imports: [ObservabilityModule, ChatModule, MealLogsModule, SubscriptionsModule],
  controllers: [TelegramController],
  providers: [
    TelegramService,
    TelegramBotService,
    IdempotencyService,
    IdempotencyCleanupService,
    TelegramFoodParserService,
  ],
  exports: [TelegramService, IdempotencyService],
})
export class TelegramModule {}
