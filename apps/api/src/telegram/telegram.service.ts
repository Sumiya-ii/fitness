import { createHmac } from 'crypto';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  HttpException,
  HttpStatus,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma';
import { ConfigService } from '../config';
import { REDIS } from '../redis';

const LINK_CODE_PREFIX = 'telegram:link:';
const LINK_CODE_TTL_SECONDS = 300; // 5 minutes

// Brute-force protection for the @Public() /telegram/confirm endpoint.
// A 6-digit code has only 1M possibilities, so without per-code limiting an
// attacker could enumerate it within the 5-minute TTL. Cap attempts per code.
const CONFIRM_ATTEMPT_PREFIX = 'telegram:confirm-attempts:';
const CONFIRM_MAX_ATTEMPTS = 5;
const CONFIRM_ATTEMPT_TTL_SECONDS = 300; // matches link code lifetime

@Injectable()
export class TelegramService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  private hashLinkCode(code: string): string {
    const secret = this.config.get('LINK_CODE_SECRET');
    if (!secret) throw new ServiceUnavailableException('Telegram linking is not configured');
    return createHmac('sha256', secret).update(code).digest('hex');
  }

  /**
   * Generate a 6-digit link code, store the hash in Redis with 5-minute TTL,
   * and return the raw code to the caller.
   */
  async generateLinkCode(userId: string): Promise<string> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `${LINK_CODE_PREFIX}${this.hashLinkCode(code)}`;
    await this.redis.setex(key, LINK_CODE_TTL_SECONDS, userId);
    return code;
  }

  /**
   * Validate the code, create TelegramLink record, return success.
   */
  async confirmLink(
    telegramUserId: string,
    chatId: string,
    code: string,
    username?: string,
  ): Promise<{ success: boolean; userId: string }> {
    const codeHash = this.hashLinkCode(code);

    // Brute-force guard: cap the number of guesses against any single code.
    // INCR returns the post-increment value; set a TTL on the first hit so the
    // window self-expires alongside the link code.
    const attemptKey = `${CONFIRM_ATTEMPT_PREFIX}${codeHash}`;
    const attempts = await this.redis.incr(attemptKey);
    if (attempts === 1) {
      await this.redis.expire(attemptKey, CONFIRM_ATTEMPT_TTL_SECONDS);
    }
    if (attempts > CONFIRM_MAX_ATTEMPTS) {
      throw new HttpException(
        'Too many attempts. Request a new code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const key = `${LINK_CODE_PREFIX}${codeHash}`;
    const storedUserId = await this.redis.get(key);
    if (!storedUserId) {
      throw new BadRequestException('Invalid or expired link code');
    }

    // Successful match — clear the attempt counter so a legit relink isn't blocked.
    await this.redis.del(attemptKey);

    // Ensure one Telegram account links to one app user
    const existing = await this.prisma.telegramLink.findFirst({
      where: { telegramUserId, active: true },
    });
    if (existing && existing.userId !== storedUserId) {
      throw new BadRequestException('This Telegram account is already linked to another user');
    }

    await this.redis.del(key);

    await this.prisma.telegramLink.upsert({
      where: { userId: storedUserId },
      create: {
        userId: storedUserId,
        telegramUserId,
        chatId,
        telegramUsername: username ?? null,
        linkedAt: new Date(),
        active: true,
      },
      update: {
        telegramUserId,
        chatId,
        telegramUsername: username ?? null,
        linkedAt: new Date(),
        active: true,
        linkCode: null,
        linkCodeExpiresAt: null,
      },
    });

    // Ensure 'telegram' is in the user's notification channels
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId: storedUserId },
    });
    if (pref && !pref.channels.includes('telegram')) {
      await this.prisma.notificationPreference.update({
        where: { userId: storedUserId },
        data: { channels: [...pref.channels, 'telegram'] },
      });
    }

    return { success: true, userId: storedUserId };
  }

  /**
   * Get user's Telegram link status.
   */
  async getLink(userId: string): Promise<{
    linked: boolean;
    telegramUsername?: string;
    linkedAt?: string;
  }> {
    const link = await this.prisma.telegramLink.findUnique({
      where: { userId, active: true },
    });

    if (!link) {
      return { linked: false };
    }

    return {
      linked: true,
      telegramUsername: link.telegramUsername ?? undefined,
      linkedAt: link.linkedAt?.toISOString(),
    };
  }

  /**
   * Deactivate the Telegram link for the user.
   */
  async unlinkAccount(userId: string): Promise<void> {
    const link = await this.prisma.telegramLink.findUnique({
      where: { userId },
    });

    if (!link) {
      throw new NotFoundException('No Telegram account linked');
    }

    await this.prisma.telegramLink.update({
      where: { userId },
      data: { active: false },
    });

    // Remove 'telegram' from notification channels
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (pref && pref.channels.includes('telegram')) {
      await this.prisma.notificationPreference.update({
        where: { userId },
        data: { channels: pref.channels.filter((c) => c !== 'telegram') },
      });
    }
  }

  /**
   * Find user by telegramUserId and chatId (for webhook processing).
   */
  async findUserByTelegram(telegramUserId: string): Promise<string | null> {
    const link = await this.prisma.telegramLink.findFirst({
      where: {
        telegramUserId,
        active: true,
      },
    });
    return link?.userId ?? null;
  }
}
