import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from './config';
import { PrismaModule } from './prisma';
import { QueueModule } from './queue';
import { AuthModule, UserThrottlerGuard } from './auth';
import { ProfileModule } from './profile';
import { TargetsModule } from './targets';
import { FoodsModule } from './foods';
import { MealLogsModule } from './meal-logs';
import { MealTemplatesModule } from './meal-templates/meal-templates.module';
import { FavoritesModule } from './favorites';
import { DashboardModule } from './dashboard';
import { WeightLogsModule } from './weight-logs';
import { WaterLogsModule } from './water-logs';
import { SubscriptionsModule } from './subscriptions';
import { PrivacyModule } from './privacy';
import { AdminModule } from './admin';
import { NotificationsModule } from './notifications';
import { AnalyticsModule } from './analytics';
import { ObservabilityModule } from './observability';
import { StorageModule } from './storage';
import { PhotosModule } from './photos';
import { TelegramModule } from './telegram';
import { RemindersModule } from './reminders';
import { ChatModule } from './chat';
import { CoachMemoryModule } from './coach-memory/coach-memory.module';
import { OnboardingModule } from './onboarding';
import { StreaksModule } from './streaks/streaks.module';
import { HealthController } from './health/health.controller';
import { IdempotencyInterceptor } from './observability/idempotency.interceptor';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 60,
      },
      {
        name: 'burst',
        ttl: 1_000,
        limit: 10,
      },
    ]),
    ConfigModule,
    PrismaModule,
    QueueModule,
    AuthModule,
    ProfileModule,
    TargetsModule,
    OnboardingModule,
    FoodsModule,
    MealLogsModule,
    MealTemplatesModule,
    FavoritesModule,
    DashboardModule,
    WeightLogsModule,
    WaterLogsModule,
    SubscriptionsModule,
    PrivacyModule,
    AdminModule,
    NotificationsModule,
    AnalyticsModule,
    ObservabilityModule,
    StorageModule,
    PhotosModule,
    TelegramModule,
    RemindersModule,
    ChatModule,
    CoachMemoryModule,
    StreaksModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: UserThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
})
export class AppModule {}
