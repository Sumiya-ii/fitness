import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../prisma';
import { ConfigService } from '../config';

const TELEGRAM_SYSTEM = 'telegram';

export interface IdempotencyResult {
  exists: boolean;
  response?: { status: number; body: unknown };
}

@Injectable()
export class IdempotencyService implements OnModuleDestroy {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.redis = new Redis(this.config.get('REDIS_URL'));
    // Suppress ioredis unhandled connection errors — we handle them per-call
    this.redis.on('error', (err) => {
      this.logger.warn(`Redis connection error (idempotency): ${err.message}`);
    });
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  private redisKey(key: string): string {
    return `idempotency:${TELEGRAM_SYSTEM}:${key}`;
  }

  /**
   * Check if an idempotency key exists and is not expired.
   * Returns cached response if found.
   *
   * Fast path: Redis (O(1), no DB hit on the common case).
   * Fallback: DB query when Redis is unavailable.
   */
  async check(key: string): Promise<IdempotencyResult> {
    // ── Redis fast path ──────────────────────────────────────────
    try {
      const cached = await this.redis.get(this.redisKey(key));
      if (cached !== null) {
        const parsed = JSON.parse(cached) as { status: number; body: unknown };
        return { exists: true, response: parsed };
      }
    } catch (e) {
      this.logger.warn(`Redis check failed, falling back to DB: ${(e as Error).message}`);
    }

    // ── DB fallback ──────────────────────────────────────────────
    const record = await this.prisma.idempotencyKey.findUnique({
      where: {
        externalSystem_externalEventId: {
          externalSystem: TELEGRAM_SYSTEM,
          externalEventId: key,
        },
      },
    });

    if (!record || new Date() >= record.expiresAt) {
      return { exists: false };
    }

    return {
      exists: true,
      response: {
        status: record.responseStatus ?? 200,
        body: record.responseBody ?? undefined,
      },
    };
  }

  /**
   * Store an idempotency key with response for deduplication.
   *
   * Write-through: writes to DB first (durable), then to Redis (fast).
   * Redis failure is non-fatal — the DB record is the source of truth.
   */
  async store(
    key: string,
    response: { status: number; body: unknown },
    ttlMinutes: number,
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + ttlMinutes);

    // ── DB write (authoritative) ─────────────────────────────────
    await this.prisma.idempotencyKey.upsert({
      where: {
        externalSystem_externalEventId: {
          externalSystem: TELEGRAM_SYSTEM,
          externalEventId: key,
        },
      },
      create: {
        externalSystem: TELEGRAM_SYSTEM,
        externalEventId: key,
        responseStatus: response.status,
        responseBody: response.body as object,
        expiresAt,
      },
      update: {
        responseStatus: response.status,
        responseBody: response.body as object,
        expiresAt,
      },
    });

    // ── Redis write (best-effort cache) ──────────────────────────
    try {
      const ttlSeconds = ttlMinutes * 60;
      await this.redis.set(
        this.redisKey(key),
        JSON.stringify({ status: response.status, body: response.body }),
        'EX',
        ttlSeconds,
      );
    } catch (e) {
      // Redis down — DB record is sufficient for correctness
      this.logger.warn(`Redis store failed (non-fatal): ${(e as Error).message}`);
    }
  }
}
