import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '../config';

const DAILY_LIMIT = 30;
// 25 hours in seconds — ensures rollover even with slight UTC drift
const TTL_SECONDS = 90000;

@Injectable()
export class VoiceRateLimitService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(private readonly config: ConfigService) {
    this.redis = new Redis(this.config.get('REDIS_URL'));
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  async incrementAndCheck(
    userId: string,
  ): Promise<{ allowed: boolean; count: number; limit: number }> {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD UTC
    const key = `voice:rl:${userId}:${date}`;

    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, TTL_SECONDS);
    }

    return { allowed: count <= DAILY_LIMIT, count, limit: DAILY_LIMIT };
  }
}
