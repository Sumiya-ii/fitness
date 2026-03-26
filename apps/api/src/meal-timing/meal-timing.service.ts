import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma';
import { ConfigService } from '../config';
import { QUEUE_NAMES } from '@coach/shared';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

export interface MealTimingStats {
  mealType: string;
  avgHour: number; // fractional hour, e.g. 8.5 = 08:30
  count: number;
}

export interface MealTimingInsights {
  weekStart: string;
  weekEnd: string;
  // Per-meal-type average logged hour
  mealStats: MealTimingStats[];
  // % of weekdays (Mon–Fri) where breakfast was logged
  breakfastWeekdayRate: number;
  // % of weekend days (Sat–Sun) where breakfast was logged
  breakfastWeekendRate: number;
  // Number of days in the window that had any meal logged after 20:00
  lateNightEatingDays: number;
  // Average eating window in minutes (first log → last log per day); null if < 2 meals/day
  avgEatingWindowMinutes: number | null;
  // Human-readable key finding (up to 3 strings)
  highlights: string[];
}

export interface MealTimingJobData {
  userId: string;
  channels: string[];
  chatId?: string;
  locale?: string;
  pushTokens?: string[];
  userName: string | null;
  insights: MealTimingInsights;
}

@Injectable()
export class MealTimingService {
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_NAMES.MEAL_TIMING_INSIGHTS) private readonly queue: Queue,
  ) {
    this.redis = new Redis(this.config.get('REDIS_URL'));
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  private sentKey(userId: string, weekStart: string): string {
    return `meal_timing_insights:sent:${userId}:${weekStart}`;
  }

  /**
   * Compute meal-timing insights for a user over the given 7-day window.
   * All computations are done in JS after a single Prisma query so this can be
   * unit-tested without a real database.
   */
  computeInsights(
    mealLogs: Array<{ loggedAt: Date; mealType: string | null }>,
    timezone: string,
    weekStart: DateTime,
  ): MealTimingInsights {
    const weekEnd = weekStart.plus({ days: 6 });

    // ── Localise timestamps ───────────────────────────────────────
    const localLogs = mealLogs.map((log) => {
      const dt = DateTime.fromJSDate(log.loggedAt).setZone(timezone);
      return {
        mealType: (log.mealType ?? 'snack').toLowerCase(),
        hour: dt.hour + dt.minute / 60 + dt.second / 3600,
        weekday: dt.weekday, // 1=Mon … 7=Sun
        dateKey: dt.toISODate()!,
      };
    });

    // ── Per meal-type average hour ────────────────────────────────
    const byType = new Map<string, number[]>();
    for (const log of localLogs) {
      const arr = byType.get(log.mealType) ?? [];
      arr.push(log.hour);
      byType.set(log.mealType, arr);
    }

    const mealStats: MealTimingStats[] = Array.from(byType.entries()).map(([mealType, hours]) => ({
      mealType,
      avgHour: hours.reduce((s, h) => s + h, 0) / hours.length,
      count: hours.length,
    }));

    // ── Breakfast frequency ───────────────────────────────────────
    const breakfastLogs = localLogs.filter((l) => l.mealType === 'breakfast');
    const breakfastDays = new Set(breakfastLogs.map((l) => l.dateKey));

    // Build sets of weekday and weekend dates in the window
    const weekdayDates: string[] = [];
    const weekendDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = weekStart.plus({ days: i });
      if (d.weekday <= 5) weekdayDates.push(d.toISODate()!);
      else weekendDates.push(d.toISODate()!);
    }

    const breakfastWeekdayRate =
      weekdayDates.length > 0
        ? Math.round(
            (weekdayDates.filter((d) => breakfastDays.has(d)).length / weekdayDates.length) * 100,
          )
        : 0;

    const breakfastWeekendRate =
      weekendDates.length > 0
        ? Math.round(
            (weekendDates.filter((d) => breakfastDays.has(d)).length / weekendDates.length) * 100,
          )
        : 0;

    // ── Late-night eating (after 20:00) ───────────────────────────
    const lateNightDays = new Set(localLogs.filter((l) => l.hour >= 20).map((l) => l.dateKey));
    const lateNightEatingDays = lateNightDays.size;

    // ── Eating window per day ─────────────────────────────────────
    const byDay = new Map<string, { minHour: number; maxHour: number; count: number }>();
    for (const log of localLogs) {
      const existing = byDay.get(log.dateKey);
      if (!existing) {
        byDay.set(log.dateKey, { minHour: log.hour, maxHour: log.hour, count: 1 });
      } else {
        existing.minHour = Math.min(existing.minHour, log.hour);
        existing.maxHour = Math.max(existing.maxHour, log.hour);
        existing.count++;
      }
    }

    const dayWindows = Array.from(byDay.values()).filter((d) => d.count >= 2);
    const avgEatingWindowMinutes =
      dayWindows.length > 0
        ? Math.round(
            dayWindows.reduce((s, d) => s + (d.maxHour - d.minHour) * 60, 0) / dayWindows.length,
          )
        : null;

    // ── Key highlights ────────────────────────────────────────────
    const highlights: string[] = [];

    if (breakfastWeekdayRate < 60) {
      highlights.push(
        `Та ажлын өдрүүдийн зөвхөн ${breakfastWeekdayRate}%-д өглөөний хоол идсэн байна.`,
      );
    } else {
      highlights.push(
        `Та ажлын өдрүүдийн ${breakfastWeekdayRate}%-д өглөөний хоолоо цагтаа идсэн байна.`,
      );
    }

    if (lateNightEatingDays >= 3) {
      highlights.push(
        `7 хоногийн ${lateNightEatingDays} өдөр шөнийн 20:00-аас хойш хоол идсэн байна.`,
      );
    }

    if (avgEatingWindowMinutes !== null) {
      const hours = Math.floor(avgEatingWindowMinutes / 60);
      const mins = avgEatingWindowMinutes % 60;
      const windowStr = mins > 0 ? `${hours} цаг ${mins} минут` : `${hours} цаг`;
      if (avgEatingWindowMinutes > 12 * 60) {
        highlights.push(
          `Таны өдрийн хоол идэх цонх дунджаар ${windowStr} байна — бага зэрэг богиносговол ашигтай.`,
        );
      } else {
        highlights.push(`Таны өдрийн хоол идэх цонх дунджаар ${windowStr} байна.`);
      }
    }

    return {
      weekStart: weekStart.toISODate()!,
      weekEnd: weekEnd.toISODate()!,
      mealStats,
      breakfastWeekdayRate,
      breakfastWeekendRate,
      lateNightEatingDays,
      avgEatingWindowMinutes,
      highlights,
    };
  }

  /**
   * Compute insights for a single user given a week-start date string (YYYY-MM-DD).
   * If no date is provided, defaults to the last full Mon–Sun week.
   */
  async getInsights(userId: string, weekStartDate?: string): Promise<MealTimingInsights> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    const timezone = profile?.timezone ?? 'Asia/Ulaanbaatar';
    let weekStart: DateTime;

    if (weekStartDate) {
      const [y, m, d] = weekStartDate.split('-').map(Number);
      weekStart = DateTime.fromObject({ year: y, month: m, day: d }, { zone: timezone });
    } else {
      // Default: last full week (Mon–Sun)
      weekStart = DateTime.now().setZone(timezone).minus({ weeks: 1 }).startOf('week');
    }

    const from = weekStart.toJSDate();
    const to = weekStart.plus({ days: 7 }).toJSDate();

    const mealLogs = await this.prisma.mealLog.findMany({
      where: { userId, loggedAt: { gte: from, lt: to } },
      select: { loggedAt: true, mealType: true },
    });

    return this.computeInsights(mealLogs, timezone, weekStart);
  }

  /**
   * Fan-out: schedule meal-timing insight jobs for users whose local time is Monday 9–10 AM.
   */
  async scheduleMealTimingInsights(): Promise<number> {
    const prefs = await this.prisma.notificationPreference.findMany();
    let enqueued = 0;

    for (const pref of prefs) {
      const now = DateTime.now().setZone(pref.reminderTimezone);

      // Only fire on Monday between 9:00–10:00 AM local time
      if (now.weekday !== 1 || now.hour < 9 || now.hour >= 10) continue;

      const lastMonday = now.minus({ weeks: 1 }).startOf('week');
      const weekStart = lastMonday.toISODate()!;

      // Dedup
      const sentKey = this.sentKey(pref.userId, weekStart);
      if (await this.redis.get(sentKey)) continue;

      const from = lastMonday.toJSDate();
      const to = lastMonday.plus({ days: 7 }).toJSDate();

      const [mealLogs, profile, tgLink, deviceTokens] = await Promise.all([
        this.prisma.mealLog.findMany({
          where: { userId: pref.userId, loggedAt: { gte: from, lt: to } },
          select: { loggedAt: true, mealType: true },
        }),
        this.prisma.profile.findUnique({ where: { userId: pref.userId } }),
        this.prisma.telegramLink.findUnique({ where: { userId: pref.userId } }),
        this.prisma.deviceToken.findMany({
          where: { userId: pref.userId, active: true },
          select: { token: true },
        }),
      ]);

      // Skip users with no meal data last week
      if (mealLogs.length === 0) continue;

      const insights = this.computeInsights(mealLogs, pref.reminderTimezone, lastMonday);

      const jobData: MealTimingJobData = {
        userId: pref.userId,
        channels: pref.channels,
        chatId: tgLink?.active ? (tgLink.chatId ?? undefined) : undefined,
        locale: profile?.locale ?? undefined,
        pushTokens: deviceTokens.map((d) => d.token),
        userName: profile?.displayName ?? null,
        insights,
      };

      await this.queue.add('meal_timing_insights', jobData, {
        jobId: `meal-timing-insights-${pref.userId}-${weekStart}`,
      });

      await this.redis.setex(sentKey, 8 * 24 * 60 * 60, '1');
      enqueued++;
    }

    return enqueued;
  }
}
