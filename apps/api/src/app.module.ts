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
import { SearchModule } from './search';
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
    SearchModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
