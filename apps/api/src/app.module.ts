import { Module } from '@nestjs/common';
import { ConfigModule } from './config';
import { PrismaModule } from './prisma';
import { QueueModule } from './queue';
import { AuthModule } from './auth';
import { ProfileModule } from './profile';
import { TargetsModule } from './targets';
import { HealthController } from './health/health.controller';

@Module({
  imports: [ConfigModule, PrismaModule, QueueModule, AuthModule, ProfileModule, TargetsModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
