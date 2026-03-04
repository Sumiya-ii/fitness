import { Module } from '@nestjs/common';
import { ConfigModule } from './config';
import { PrismaModule } from './prisma';
import { QueueModule } from './queue';
import { AuthModule } from './auth';
import { ProfileModule } from './profile';
import { TargetsModule } from './targets';
import { FoodsModule } from './foods';
import { MealLogsModule } from './meal-logs';
import { FavoritesModule } from './favorites';
import { BarcodesModule } from './barcodes';
import { DashboardModule } from './dashboard';
import { WeightLogsModule } from './weight-logs';
import { WeeklySummaryModule } from './weekly-summary';
import { SearchModule } from './search';
import { SubscriptionsModule } from './subscriptions';
import { PrivacyModule } from './privacy';
import { AdminModule } from './admin';
import { NotificationsModule } from './notifications';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    QueueModule,
    AuthModule,
    ProfileModule,
    TargetsModule,
    FoodsModule,
    MealLogsModule,
    FavoritesModule,
    BarcodesModule,
    DashboardModule,
    WeightLogsModule,
    WeeklySummaryModule,
    SearchModule,
    SubscriptionsModule,
    PrivacyModule,
    AdminModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
