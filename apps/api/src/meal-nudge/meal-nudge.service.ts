import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma';
import { QUEUE_NAMES } from '@coach/shared';

export interface MealNudgeJobData {
  userId: string;
  channels: string[];
  chatId?: string;
  locale?: string;
  pushTokens?: string[];
  mealCount: number;
}

function getLocalHour(timezone: string): number {
  return DateTime.now().setZone(timezone).hour;
}

function getLocalDayStart(timezone: string): Date {
  return DateTime.now().setZone(timezone).startOf('day').toJSDate();
}

@Injectable()
export class MealNudgeService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.MEAL_NUDGE) private readonly nudgeQueue: Queue,
  ) {}

  /**
   * Enqueue meal nudges for users who:
   * - have eveningReminder enabled
   * - are in the 8–9 PM local window
   * - logged exactly 1 meal today (count === 0 is handled by the evening reminder)
   */
  async scheduleMealNudges(): Promise<number> {
    const prefs = await this.prisma.notificationPreference.findMany({
      where: { eveningReminder: true },
    });

    let enqueued = 0;

    for (const pref of prefs) {
      const [tgLink, profile, deviceTokens] = await Promise.all([
        this.prisma.telegramLink.findUnique({ where: { userId: pref.userId } }),
        this.prisma.profile.findUnique({ where: { userId: pref.userId } }),
        this.prisma.deviceToken.findMany({
          where: { userId: pref.userId },
          select: { token: true },
        }),
      ]);

      const tz = profile?.timezone ?? pref.reminderTimezone;

      const localHour = getLocalHour(tz);
      if (localHour < 20 || localHour >= 21) continue;

      const todayStart = getLocalDayStart(tz);
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      const mealCount = await this.prisma.mealLog.count({
        where: {
          userId: pref.userId,
          loggedAt: { gte: todayStart, lt: todayEnd },
        },
      });

      // Only nudge users who logged exactly 1 meal — 0 is handled by evening reminder
      if (mealCount !== 1) continue;

      await this.nudgeQueue.add(
        'meal-nudge',
        {
          userId: pref.userId,
          channels: pref.channels,
          chatId: tgLink?.active ? (tgLink.chatId ?? undefined) : undefined,
          locale: profile?.locale ?? undefined,
          pushTokens: deviceTokens.map((d) => d.token),
          mealCount,
        } satisfies MealNudgeJobData,
        { jobId: `meal-nudge-${pref.userId}-${Date.now()}` },
      );
      enqueued++;
    }

    return enqueued;
  }
}
