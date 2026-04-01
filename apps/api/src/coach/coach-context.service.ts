import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma';
import { CoachContext } from './coach.types';

@Injectable()
export class CoachContextService {
  constructor(private readonly prisma: PrismaService) {}

  async buildContext(
    userId: string,
    timezone: string,
    messageType: CoachContext['messageType'],
  ): Promise<CoachContext> {
    const now = DateTime.now().setZone(timezone);
    const todayStart = now.startOf('day').toJSDate();
    const todayEnd = now.endOf('day').toJSDate();
    const sevenDaysAgo = now.minus({ days: 7 }).startOf('day').toJSDate();

    const [profile, target, mealLogs, waterLogs, weeklyMealLogs, weeklyWaterLogs] =
      await Promise.all([
        this.prisma.profile.findUnique({ where: { userId } }),
        this.prisma.target.findFirst({
          where: { userId, effectiveTo: null },
          orderBy: { effectiveFrom: 'desc' },
        }),
        this.prisma.mealLog.findMany({
          where: { userId, loggedAt: { gte: todayStart, lt: todayEnd } },
          select: {
            mealType: true,
            totalCalories: true,
            totalProtein: true,
            totalCarbs: true,
            totalFat: true,
          },
        }),
        this.prisma.waterLog.findMany({
          where: { userId, loggedAt: { gte: todayStart, lt: todayEnd } },
          select: { amountMl: true },
        }),
        this.prisma.mealLog.findMany({
          where: { userId, loggedAt: { gte: sevenDaysAgo, lt: todayStart } },
          select: { loggedAt: true, totalCalories: true },
        }),
        this.prisma.waterLog.findMany({
          where: { userId, loggedAt: { gte: sevenDaysAgo, lt: todayStart } },
          select: { loggedAt: true, amountMl: true },
        }),
      ]);

    // Today aggregates
    const waterMl = waterLogs.reduce((s, l) => s + l.amountMl, 0);
    const caloriesConsumed = mealLogs.reduce((s, l) => s + (l.totalCalories ?? 0), 0);
    const proteinConsumed = mealLogs.reduce((s, l) => s + Number(l.totalProtein ?? 0), 0);
    const carbsConsumed = mealLogs.reduce((s, l) => s + Number(l.totalCarbs ?? 0), 0);
    const fatConsumed = mealLogs.reduce((s, l) => s + Number(l.totalFat ?? 0), 0);
    const mealTypes = [...new Set(mealLogs.map((l) => l.mealType).filter(Boolean))] as string[];

    // Weekly aggregates (last 7 days, excluding today)
    const weeklyByDay = new Map<string, { calories: number; waterMl: number; mealCount: number }>();
    for (let i = 1; i <= 7; i++) {
      const d = now.minus({ days: i }).toISODate()!;
      weeklyByDay.set(d, { calories: 0, waterMl: 0, mealCount: 0 });
    }
    for (const log of weeklyMealLogs) {
      const key = DateTime.fromJSDate(log.loggedAt).setZone(timezone).toISODate()!;
      const day = weeklyByDay.get(key);
      if (day) {
        day.calories += log.totalCalories ?? 0;
        day.mealCount += 1;
      }
    }
    for (const log of weeklyWaterLogs) {
      const key = DateTime.fromJSDate(log.loggedAt).setZone(timezone).toISODate()!;
      const day = weeklyByDay.get(key);
      if (day) day.waterMl += log.amountMl;
    }

    const weekDays = Array.from(weeklyByDay.values());
    const totalDays = weekDays.length;
    const avgDailyCalories =
      totalDays > 0 ? Math.round(weekDays.reduce((s, d) => s + d.calories, 0) / totalDays) : 0;
    const avgMealsPerDay =
      totalDays > 0
        ? Number((weekDays.reduce((s, d) => s + d.mealCount, 0) / totalDays).toFixed(1))
        : 0;
    const waterTarget = profile?.waterTargetMl ?? 2000;
    const daysWithWaterGoalMet = weekDays.filter((d) => d.waterMl >= waterTarget).length;

    // Streak calculation — consecutive days WITH at least 1 meal logged (backwards from yesterday)
    let mealLoggingDays = 0;
    let waterGoalDays = 0;
    for (let i = 1; i <= 7; i++) {
      const key = now.minus({ days: i }).toISODate()!;
      const day = weeklyByDay.get(key);
      if (!day) break;
      if (day.mealCount > 0) mealLoggingDays++;
      else break;
    }
    for (let i = 1; i <= 7; i++) {
      const key = now.minus({ days: i }).toISODate()!;
      const day = weeklyByDay.get(key);
      if (!day) break;
      if (day.waterMl >= waterTarget) waterGoalDays++;
      else break;
    }

    return {
      userName: profile?.displayName ?? null,
      locale: (profile?.locale as 'mn' | 'en') ?? 'mn',
      today: {
        mealsLogged: mealLogs.length,
        caloriesConsumed: Math.round(caloriesConsumed),
        caloriesTarget: target?.calorieTarget ?? null,
        proteinConsumed: Number(proteinConsumed.toFixed(1)),
        proteinTarget: target ? Number(target.proteinGrams) : null,
        carbsConsumed: Number(carbsConsumed.toFixed(1)),
        fatConsumed: Number(fatConsumed.toFixed(1)),
        waterMl,
        waterTarget,
        mealTypes,
      },
      streak: { mealLoggingDays, waterGoalDays },
      weekly: { avgDailyCalories, avgMealsPerDay, daysWithWaterGoalMet, totalDays },
      messageType,
      localTime: now.toFormat('HH:mm'),
    };
  }
}
