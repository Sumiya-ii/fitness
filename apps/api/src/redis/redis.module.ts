import { Global, Module, OnApplicationShutdown, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigModule } from '../config';
import { ConfigService } from '../config';
import { REDIS } from './redis.constants';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS,
      useFactory: (config: ConfigService): Redis => {
        return new Redis(config.get('REDIS_URL'), {
          lazyConnect: false,
          retryStrategy: (times: number) => Math.min(times * 100, 3000),
          maxRetriesPerRequest: null,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
