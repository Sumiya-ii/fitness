import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma';
import type { UpdatePreferencesDto, RegisterDeviceTokenDto } from './notifications.dto';

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
          morningReminder: true,
          eveningReminder: true,
          reminderTimezone: 'Asia/Ulaanbaatar',
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
        morningReminder: dto.morningReminder ?? true,
        eveningReminder: dto.eveningReminder ?? true,
        reminderTimezone: dto.reminderTimezone ?? 'Asia/Ulaanbaatar',
        quietHoursStart: dto.quietHoursStart ?? null,
        quietHoursEnd: dto.quietHoursEnd ?? null,
        channels: dto.channels ?? ['push'],
      },
      update: {
        ...(dto.morningReminder !== undefined && {
          morningReminder: dto.morningReminder,
        }),
        ...(dto.eveningReminder !== undefined && {
          eveningReminder: dto.eveningReminder,
        }),
        ...(dto.reminderTimezone !== undefined && {
          reminderTimezone: dto.reminderTimezone,
        }),
        ...(dto.quietHoursStart !== undefined && {
          quietHoursStart: dto.quietHoursStart,
        }),
        ...(dto.quietHoursEnd !== undefined && {
          quietHoursEnd: dto.quietHoursEnd,
        }),
        ...(dto.channels !== undefined && { channels: dto.channels }),
      },
    });

    return this.formatPreferences(prefs);
  }

  private formatPreferences(prefs: {
    id: string;
    morningReminder: boolean;
    eveningReminder: boolean;
    reminderTimezone: string;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
    channels: string[];
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: prefs.id,
      morningReminder: prefs.morningReminder,
      eveningReminder: prefs.eveningReminder,
      reminderTimezone: prefs.reminderTimezone,
      quietHoursStart: prefs.quietHoursStart,
      quietHoursEnd: prefs.quietHoursEnd,
      channels: prefs.channels,
      createdAt: prefs.createdAt.toISOString(),
      updatedAt: prefs.updatedAt.toISOString(),
    };
  }
}
