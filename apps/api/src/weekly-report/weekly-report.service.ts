import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DateTime } from 'luxon';
import Redis from 'ioredis';
import { PrismaService } from '../prisma';
import { ConfigService } from '../config';
import { QUEUE_NAMES } from '@coach/shared';
import { CoachMemoryService } from '../coach-memory/coach-memory.service';

export interface WeeklyReportData {
  weekStart: string;
  weekEnd: string;
  daysLogged: number;
  averageCalories: number;
  averageProtein: number;
  calorieTarget: number | null;
  proteinTarget: number | null;
  adherenceScore: number;
  weightDelta: number | null;
  endOfWeekStreak: number;
}

export interface WeeklyReportJobData {
  userId: string;
  channels: string[];
  chatId?: string;
  locale?: string;
  pushTokens?: string[];
  report: WeeklyReportData;
  userName: string | null;
  memoryBlock?: string;
}

@Injectable()
export class WeeklyReportService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly memoryService: CoachMemoryService,
    @InjectQueue(QUEUE_NAMES.WEEKLY_REPORT) private readonly weeklyReportQueue: Queue,
  ) {
    this.redis = new Redis(this.config.get('REDIS_URL'));
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  private sentKey(userId: string, weekStart: string): string {
    return `weekly_report:sent:${userId}:${weekStart}`;
  }

  /**
   * Build the weekly report data for a given user and last-week range.
   * Exported so it can be unit-tested independently of scheduling.
   */
  buildReport(
    mealLogs: Array<{
      loggedAt: Date;
      totalCalories: number | null;
      totalProtein: unknown;
    }>,
    weightLogs: Array<{ weightKg: unknown; loggedAt: Date }>,
    calorieTarget: number | null,
    proteinTarget: number | null,
    timezone: string,
    lastMonday: DateTime,
  ): WeeklyReportData {
    const weekStart = lastMonday.toISODate()!;
    const weekEnd = lastMonday.plus({ days: 6 }).toISODate()!;

    // Aggregate per day
    const dayTotals = new Map<string, { calories: number; protein: number }>();
    for (const log of mealLogs) {
      const key = DateTime.fromJSDate(log.loggedAt).setZone(timezone).toISODate()!;
      const existing = dayTotals.get(key) ?? { calories: 0, protein: 0 };
      existing.calories += log.totalCalories ?? 0;
      existing.protein += Number(log.totalProtein ?? 0);
      dayTotals.set(key, existing);
    }

    const daysLogged = dayTotals.size;
    const values = Array.from(dayTotals.values());
    const averageCalories =
      daysLogged > 0 ? Math.round(values.reduce((s, d) => s + d.calories, 0) / daysLogged) : 0;
    const averageProtein =
      daysLogged > 0
        ? Number((values.reduce((s, d) => s + d.protein, 0) / daysLogged).toFixed(1))
        : 0;
    const adherenceScore = Number(((daysLogged / 7) * 100).toFixed(1));

    let weightDelta: number | null = null;
    if (weightLogs.length >= 2) {
      const first = Number(weightLogs[0].weightKg);
      const last = Number(weightLogs[weightLogs.length - 1].weightKg);
      weightDelta = Number((last - first).toFixed(1));
    }

    // End-of-week streak: consecutive logged days going back from Sunday
    const lastSunday = lastMonday.plus({ days: 6 });
    let endOfWeekStreak = 0;
    for (let i = 0; i < 7; i++) {
      const key = lastSunday.minus({ days: i }).toISODate()!;
      if (dayTotals.has(key)) {
        endOfWeekStreak++;
      } else {
        break;
      }
    }

    return {
      weekStart,
      weekEnd,
      daysLogged,
      averageCalories,
      averageProtein,
      calorieTarget,
      proteinTarget,
      adherenceScore,
      weightDelta,
      endOfWeekStreak,
    };
  }

  /**
   * Schedule weekly reports for users whose local time is Monday 9–10 AM.
   * Uses a Redis dedup key to send at most once per user per week.
   */
  async scheduleWeeklyReports(): Promise<number> {
    const prefs = await this.prisma.notificationPreference.findMany();
    let enqueued = 0;

    for (const pref of prefs) {
      const now = DateTime.now().setZone(pref.reminderTimezone);

      // Only fire on Monday between 9:00–10:00 AM local time
      if (now.weekday !== 1 || now.hour < 9 || now.hour >= 10) continue;

      // Last week: Mon–Sun before this Monday
      const lastMonday = now.minus({ weeks: 1 }).startOf('week');
      const weekStart = lastMonday.toISODate()!;

      // Dedup: only send once per user per week
      const sentKey = this.sentKey(pref.userId, weekStart);
      if (await this.redis.get(sentKey)) continue;

      const weekStartDate = lastMonday.toJSDate();
      const weekEndDate = lastMonday.plus({ days: 7 }).toJSDate();

      const [mealLogs, weightLogs, profile, target, tgLink, deviceTokens] = await Promise.all([
        this.prisma.mealLog.findMany({
          where: { userId: pref.userId, loggedAt: { gte: weekStartDate, lt: weekEndDate } },
          select: { loggedAt: true, totalCalories: true, totalProtein: true },
        }),
        this.prisma.weightLog.findMany({
          where: { userId: pref.userId, loggedAt: { gte: weekStartDate, lt: weekEndDate } },
          orderBy: { loggedAt: 'asc' },
        }),
        this.prisma.profile.findUnique({ where: { userId: pref.userId } }),
        this.prisma.target.findFirst({
          where: { userId: pref.userId, effectiveTo: null },
          orderBy: { effectiveFrom: 'desc' },
        }),
        this.prisma.telegramLink.findUnique({ where: { userId: pref.userId } }),
        this.prisma.deviceToken.findMany({
          where: { userId: pref.userId, active: true },
          select: { token: true },
        }),
      ]);

      const report = this.buildReport(
        mealLogs,
        weightLogs,
        target?.calorieTarget ?? null,
        target ? Number(target.proteinGrams) : null,
        pref.reminderTimezone,
        lastMonday,
      );

      const memoryBlock = await this.memoryService.getMemoryBlock(pref.userId).catch(() => null);

      const jobData: WeeklyReportJobData = {
        userId: pref.userId,
        channels: pref.channels,
        chatId: tgLink?.active ? (tgLink.chatId ?? undefined) : undefined,
        locale: profile?.locale ?? undefined,
        pushTokens: deviceTokens.map((d) => d.token),
        report,
        userName: profile?.displayName ?? null,
        memoryBlock: memoryBlock ?? undefined,
      };

      await this.weeklyReportQueue.add('weekly_report', jobData, {
        jobId: `weekly-report-${pref.userId}-${weekStart}`,
      });

      // Mark sent for 8 days so cron doesn't fire again this week
      await this.redis.setex(sentKey, 8 * 24 * 60 * 60, '1');
      enqueued++;
    }

    return enqueued;
  }
}
