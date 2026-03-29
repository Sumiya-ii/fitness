import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '../config';
import { ObservabilityModule } from '../observability';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { TelegramBotService } from './telegram-bot.service';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyCleanupService } from './idempotency-cleanup.service';
import { TelegramFoodParserService } from './telegram-food-parser.service';
import { ChatModule } from '../chat';
import { MealLogsModule } from '../meal-logs/meal-logs.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ObservabilityModule,
    ConfigModule,
    ChatModule,
    MealLogsModule,
  ],
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
