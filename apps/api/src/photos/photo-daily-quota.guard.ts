import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import Redis from 'ioredis';
import { ConfigService } from '../config';
import { SubscriptionsService } from '../subscriptions';
import type { AuthenticatedUser } from '../auth';

const FREE_DAILY_CAP = 50;
const PRO_DAILY_CAP = 200;

/** Redis key: photo_quota:{userId}:{YYYY-MM-DD} */
function quotaKey(userId: string): string {
  const today = new Date().toISOString().split('T')[0]!;
  return `photo_quota:${userId}:${today}`;
}

/** Seconds remaining until midnight UTC — used as Redis TTL so the key auto-expires at day rollover */
function secondsUntilMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.ceil((midnight.getTime() - now.getTime()) / 1000);
}

@Injectable()
export class PhotoDailyQuotaGuard implements CanActivate, OnModuleDestroy {
  private readonly logger = new Logger(PhotoDailyQuotaGuard.name);
  private readonly redis: Redis;

  constructor(
    private readonly config: ConfigService,
    private readonly subscriptions: SubscriptionsService,
  ) {
    this.redis = new Redis(this.config.get('REDIS_URL'));
    this.redis.on('error', (err) => {
      this.logger.warn(`Redis connection error (photo quota): ${err.message}`);
    });
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser; requestId?: string }>();
    const user = request.user;

    if (!user) {
      // AuthGuard runs before this guard — if user is absent something is wrong
      return true;
    }

    const tier = await this.subscriptions.checkEntitlement(user.id);
    const cap = tier === 'pro' ? PRO_DAILY_CAP : FREE_DAILY_CAP;

    const key = quotaKey(user.id);
    let count: number;
    try {
      const raw = await this.redis.get(key);
      count = raw ? parseInt(raw, 10) : 0;
    } catch (err) {
      // Redis unavailable — fail open to avoid blocking legitimate uploads
      this.logger.warn(`Redis unavailable for photo quota check: ${(err as Error).message}`);
      return true;
    }

    if (count >= cap) {
      const requestId = request.requestId;
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Өдрийн зургийн хязгаарт хүрлээ (${cap}). / Daily photo upload limit reached (${cap}).`,
          requestId,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Increment counter; set TTL only on first write so it expires at midnight UTC
    try {
      const newCount = await this.redis.incr(key);
      if (newCount === 1) {
        await this.redis.expire(key, secondsUntilMidnightUTC());
      }
    } catch (err) {
      // Increment failed — still allow the request through
      this.logger.warn(`Redis increment failed for photo quota: ${(err as Error).message}`);
    }

    return true;
  }
}
