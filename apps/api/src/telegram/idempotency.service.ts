import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma';

const TELEGRAM_SYSTEM = 'telegram';

export interface IdempotencyResult {
  exists: boolean;
  response?: { status: number; body: unknown };
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if an idempotency key exists and is not expired.
   * Returns cached response if found.
   */
  async check(key: string): Promise<IdempotencyResult> {
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
   */
  async store(
    key: string,
    response: { status: number; body: unknown },
    ttlMinutes: number,
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + ttlMinutes);

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
  }
}
