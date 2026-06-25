import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma';
import type { UpdatePreferencesDto, RegisterDeviceTokenDto } from './notifications.dto';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPreferences(userId: string) {
    let prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!prefs) {
      prefs = await this.prisma.notificationPreference.create({
        data: {
          userId,
          channels: ['push'],
        },
      });
    }

    return this.formatPreferences(prefs);
  }

  async registerDeviceToken(userId: string, dto: RegisterDeviceTokenDto) {
    await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: {
        userId,
        token: dto.token,
        platform: dto.platform,
      },
      update: {
        userId,
        platform: dto.platform,
        updatedAt: new Date(),
      },
    });
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const prefs = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        channels: dto.channels ?? ['push'],
      },
      update: {
        ...(dto.channels !== undefined && { channels: dto.channels }),
      },
    });

    return this.formatPreferences(prefs);
  }

  async sendTestNotification(userId: string) {
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId, active: true },
      select: { token: true },
    });

    if (tokens.length === 0) {
      return { sent: false, reason: 'no_active_tokens', tokenCount: 0 };
    }

    const messages = tokens.map(({ token }) => ({
      to: token,
      title: 'Coach',
      body: 'Test notification — push notifications are working!',
      sound: 'default' as const,
      data: { type: 'test' },
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      return { sent: false, reason: 'expo_api_error', status: response.status };
    }

    const json = (await response.json()) as { data?: ExpoPushTicket[] };
    const tickets = json.data ?? [];

    return {
      sent: true,
      tokenCount: tokens.length,
      tickets: tickets.map((t, i) => ({
        token: (tokens[i]?.token ?? '').slice(0, 30) + '...',
        status: t.status,
        error: t.details?.error,
      })),
    };
  }

  private formatPreferences(prefs: {
    id: string;
    channels: string[];
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: prefs.id,
      channels: prefs.channels,
      createdAt: prefs.createdAt.toISOString(),
      updatedAt: prefs.updatedAt.toISOString(),
    };
  }
}
