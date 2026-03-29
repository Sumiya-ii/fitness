import { createHmac } from 'crypto';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma';
import Redis from 'ioredis';
import { ConfigService } from '../config';

const LINK_CODE_PREFIX = 'telegram:link:';
const LINK_CODE_TTL_SECONDS = 300; // 5 minutes

@Injectable()
export class TelegramService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.redis = new Redis(this.config.get('REDIS_URL'));
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  private hashLinkCode(code: string): string {
    const secret = process.env.LINK_CODE_SECRET;
    if (!secret) throw new Error('LINK_CODE_SECRET environment variable is required');
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
    const key = `${LINK_CODE_PREFIX}${this.hashLinkCode(code)}`;
    const storedUserId = await this.redis.get(key);
    if (!storedUserId) {
      throw new BadRequestException('Invalid or expired link code');
    }

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
