import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule } from './config';
import { PrismaModule } from './prisma';
import { QueueModule } from './queue';
import { AuthModule } from './auth';
import { ProfileModule } from './profile';
import { TargetsModule } from './targets';
import { FoodsModule } from './foods';
import { MealLogsModule } from './meal-logs';
import { MealTemplatesModule } from './meal-templates/meal-templates.module';
import { FavoritesModule } from './favorites';
import { BarcodesModule } from './barcodes';
import { DashboardModule } from './dashboard';
import { WeightLogsModule } from './weight-logs';
import { WaterLogsModule } from './water-logs';
import { WeeklySummaryModule } from './weekly-summary';
import { SearchModule } from './search';
import { SubscriptionsModule } from './subscriptions';
import { PrivacyModule } from './privacy';
import { AdminModule } from './admin';
import { NotificationsModule } from './notifications';
import { AnalyticsModule } from './analytics';
import { ObservabilityModule } from './observability';
import { SttModule } from './stt';
import { StorageModule } from './storage';
import { VoiceModule } from './voice';
import { PhotosModule } from './photos';
import { TelegramModule } from './telegram';
import { RemindersModule } from './reminders';
import { ChatModule } from './chat';
import { CoachModule } from './coach/coach.module';
import { WeeklyReportModule } from './weekly-report';
import { AdaptiveTargetModule } from './adaptive-target/adaptive-target.module';
import { MealTimingModule } from './meal-timing';
import { CoachMemoryModule } from './coach-memory/coach-memory.module';
import { OnboardingModule } from './onboarding';
import { StreaksModule } from './streaks/streaks.module';
import { MealNudgeModule } from './meal-nudge';
import { QPayModule } from './qpay';
import { WorkoutLogsModule } from './workout-logs';
import { BodyCompositionModule } from './body-composition';
import { HealthController } from './health/health.controller';

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
    BarcodesModule,
    DashboardModule,
    WeightLogsModule,
    WaterLogsModule,
    WeeklySummaryModule,
    SearchModule,
    SubscriptionsModule,
    PrivacyModule,
    AdminModule,
    NotificationsModule,
    AnalyticsModule,
    ObservabilityModule,
    SttModule,
    StorageModule,
    VoiceModule,
    PhotosModule,
    TelegramModule,
    RemindersModule,
    QPayModule,
    ChatModule,
    CoachModule,
    WeeklyReportModule,
    AdaptiveTargetModule,
    MealTimingModule,
    CoachMemoryModule,
    StreaksModule,
    MealNudgeModule,
    WorkoutLogsModule,
    BodyCompositionModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
