import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DateTime } from 'luxon';
import Redis from 'ioredis';
import { PrismaService } from '../prisma';
import { ConfigService } from '../config';
import { QUEUE_NAMES } from '@coach/shared';

export type ReminderType = 'morning' | 'evening';

export interface ReminderJobData {
  userId: string;
  type: ReminderType;
  channels: string[];
  chatId?: string;
  locale?: string;
  pushTokens?: string[];
}

/**
 * Get current hour (0-23) and minute (0-59) in the given timezone.
 */
function getLocalTimeParts(timezone: string): { hour: number; minute: number } {
  const dt = DateTime.now().setZone(timezone);
  return { hour: dt.hour, minute: dt.minute };
}

/**
 * Parse "HH:mm" string to minutes since midnight.
 */
function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map((x) => parseInt(x, 10));
  return (h ?? 0) * 60 + (m ?? 0);
}

@Injectable()
export class RemindersService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_NAMES.REMINDERS) private readonly reminderQueue: Queue,
  ) {
    this.redis = new Redis(this.config.get('REDIS_URL'));
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  private async hasBeenSentToday(
    userId: string,
    type: ReminderType,
    timezone: string,
  ): Promise<boolean> {
    const dateStr = DateTime.now().setZone(timezone).toISODate()!;
    const key = `reminder:sent:${userId}:${type}:${dateStr}`;
    return (await this.redis.exists(key)) === 1;
  }

  private async markReminderSent(
    userId: string,
    type: ReminderType,
    timezone: string,
  ): Promise<void> {
    const dateStr = DateTime.now().setZone(timezone).toISODate()!;
    const key = `reminder:sent:${userId}:${type}:${dateStr}`;
    const secondsUntilMidnight = Math.ceil(
      DateTime.now().setZone(timezone).endOf('day').diffNow('seconds').seconds,
    );
    await this.redis.setex(key, secondsUntilMidnight + 3600, '1');
  }

  /**
   * Check if current time in user's timezone falls within quiet hours.
   * quietStart/quietEnd are "HH:mm" (e.g. "22:00", "07:00").
   * When quiet hours span midnight (e.g. 22:00–07:00), we're in quiet hours if
   * current >= start OR current < end.
   */
  isInQuietHours(timezone: string, quietStart: string | null, quietEnd: string | null): boolean {
    if (!quietStart || !quietEnd) return false;

    const { hour, minute } = getLocalTimeParts(timezone);
    const currentMinutes = hour * 60 + minute;
    const startMinutes = parseTimeToMinutes(quietStart);
    const endMinutes = parseTimeToMinutes(quietEnd);

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  /**
   * Schedule morning reminders for users whose local time is 8–9 AM.
   */
  async scheduleMorningReminders(): Promise<number> {
    const prefs = await this.prisma.notificationPreference.findMany({
      where: { morningReminder: true },
    });

    let enqueued = 0;

    for (const pref of prefs) {
      const [tgLink, profile, deviceTokens] = await Promise.all([
        this.prisma.telegramLink.findUnique({ where: { userId: pref.userId } }),
        this.prisma.profile.findUnique({ where: { userId: pref.userId } }),
        this.prisma.deviceToken.findMany({
          where: { userId: pref.userId, active: true },
          select: { token: true },
        }),
      ]);

      const tz = profile?.timezone ?? pref.reminderTimezone;

      const { hour: localHour } = getLocalTimeParts(tz);
      if (localHour < 8 || localHour >= 9) continue;

      if (this.isInQuietHours(tz, pref.quietHoursStart, pref.quietHoursEnd)) {
        continue;
      }

      if (await this.hasBeenSentToday(pref.userId, 'morning', tz)) continue;

      await this.reminderQueue.add(
        'morning',
        {
          userId: pref.userId,
          type: 'morning' as ReminderType,
          channels: pref.channels,
          chatId: tgLink?.active ? (tgLink.chatId ?? undefined) : undefined,
          locale: profile?.locale ?? undefined,
          pushTokens: deviceTokens.map((d) => d.token),
        } satisfies ReminderJobData,
        { jobId: `morning-${pref.userId}-${Date.now()}` },
      );
      await this.markReminderSent(pref.userId, 'morning', tz);
      enqueued++;
    }

    return enqueued;
  }

  /**
   * Schedule evening reminders for users whose local time is 8–9 PM
   * and who haven't logged any meals today.
   */
  async scheduleEveningReminders(): Promise<number> {
    const prefs = await this.prisma.notificationPreference.findMany({
      where: { eveningReminder: true },
    });

    let enqueued = 0;

    for (const pref of prefs) {
      const [tgLink, profile, deviceTokens] = await Promise.all([
        this.prisma.telegramLink.findUnique({ where: { userId: pref.userId } }),
        this.prisma.profile.findUnique({ where: { userId: pref.userId } }),
        this.prisma.deviceToken.findMany({
          where: { userId: pref.userId, active: true },
          select: { token: true },
        }),
      ]);

      const tz = profile?.timezone ?? pref.reminderTimezone;

      const { hour: localHour } = getLocalTimeParts(tz);
      if (localHour < 20 || localHour >= 21) continue;

      if (this.isInQuietHours(tz, pref.quietHoursStart, pref.quietHoursEnd)) {
        continue;
      }

      if (await this.hasBeenSentToday(pref.userId, 'evening', tz)) continue;

      const todayStart = this.getLocalDayStart(tz);
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      const mealCount = await this.prisma.mealLog.count({
        where: {
          userId: pref.userId,
          loggedAt: { gte: todayStart, lt: todayEnd },
        },
      });

      if (mealCount > 0) continue;

      await this.reminderQueue.add(
        'evening',
        {
          userId: pref.userId,
          type: 'evening' as ReminderType,
          channels: pref.channels,
          chatId: tgLink?.active ? (tgLink.chatId ?? undefined) : undefined,
          locale: profile?.locale ?? undefined,
          pushTokens: deviceTokens.map((d) => d.token),
        } satisfies ReminderJobData,
        { jobId: `evening-${pref.userId}-${Date.now()}` },
      );
      await this.markReminderSent(pref.userId, 'evening', tz);
      enqueued++;
    }

    return enqueued;
  }

  /**
   * Get start of today (00:00) in the given timezone as UTC Date.
   */
  private getLocalDayStart(timezone: string): Date {
    const start = DateTime.now().setZone(timezone).startOf('day');
    return start.toJSDate();
  }
}
