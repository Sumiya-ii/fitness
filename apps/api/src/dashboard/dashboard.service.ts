import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma';

export interface DayHistory {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  waterMl: number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDailyDashboard(userId: string, dateStr?: string) {
    const dateKey = dateStr ?? new Date().toISOString().split('T')[0]!;
    // Use explicit UTC boundaries to avoid server-timezone day-boundary drift
    const dayStart = new Date(dateKey + 'T00:00:00.000Z');
    const dayEnd = new Date(dateKey + 'T00:00:00.000Z');
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const [mealLogs, target, waterLogs, profile] = await Promise.all([
      this.prisma.mealLog.findMany({
        where: {
          userId,
          loggedAt: { gte: dayStart, lt: dayEnd },
        },
        include: { items: true },
      }),
      this.prisma.target.findFirst({
        where: { userId, effectiveTo: null },
        orderBy: { effectiveFrom: 'desc' },
      }),
      this.prisma.waterLog.findMany({
        where: { userId, loggedAt: { gte: dayStart, lt: dayEnd } },
        select: { amountMl: true },
      }),
      this.prisma.profile.findUnique({
        where: { userId },
        select: { waterTargetMl: true },
      }),
    ]);

    const waterConsumed = waterLogs.reduce((sum, l) => sum + l.amountMl, 0);
    const waterTarget = profile?.waterTargetMl ?? 2000;

    const consumed = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: null as number | null,
    };

    for (const log of mealLogs) {
      consumed.calories += log.totalCalories ?? 0;
      consumed.protein += Number(log.totalProtein ?? 0);
      consumed.carbs += Number(log.totalCarbs ?? 0);
      consumed.fat += Number(log.totalFat ?? 0);
      if (log.totalFiber !== null && log.totalFiber !== undefined) {
        consumed.fiber = Number(((consumed.fiber ?? 0) + Number(log.totalFiber)).toFixed(1));
      }
    }

    consumed.protein = Number(consumed.protein.toFixed(1));
    consumed.carbs = Number(consumed.carbs.toFixed(1));
    consumed.fat = Number(consumed.fat.toFixed(1));

    const targets = target
      ? {
          calories: target.calorieTarget,
          protein: target.proteinGrams,
          carbs: target.carbsGrams,
          fat: target.fatGrams,
        }
      : null;

    const remaining = targets
      ? {
          calories: targets.calories - consumed.calories,
          protein: Number((targets.protein - consumed.protein).toFixed(1)),
          carbs: Number((targets.carbs - consumed.carbs).toFixed(1)),
          fat: Number((targets.fat - consumed.fat).toFixed(1)),
        }
      : null;

    const proteinProgress = targets
      ? {
          current: consumed.protein,
          target: targets.protein,
          percentage: Number(Math.min(100, (consumed.protein / targets.protein) * 100).toFixed(1)),
        }
      : null;

    const meals = mealLogs.map((log) => ({
      id: log.id,
      mealType: log.mealType ?? 'snack',
      totalCalories: log.totalCalories ?? 0,
      totalProtein: Number(log.totalProtein ?? 0),
      totalCarbs: Number(log.totalCarbs ?? 0),
      totalFat: Number(log.totalFat ?? 0),
      totalFiber: log.totalFiber ? Number(log.totalFiber) : null,
      loggedAt: log.loggedAt.toISOString(),
      items: log.items.map((item) => ({
        id: item.id,
        snapshotFoodName: item.snapshotFoodName,
        snapshotCalories: item.snapshotCalories,
        snapshotProtein: Number(item.snapshotProtein),
        snapshotCarbs: Number(item.snapshotCarbs),
        snapshotFat: Number(item.snapshotFat),
        snapshotFiber: item.snapshotFiber ? Number(item.snapshotFiber) : null,
      })),
    }));

    return {
      date: dateKey,
      consumed,
      targets,
      remaining,
      proteinProgress,
      mealCount: mealLogs.length,
      meals,
      waterConsumed,
      waterTarget,
    };
  }

  async getHistory(userId: string, days: number) {
    const now = new Date();
    const endKey = now.toISOString().split('T')[0]!;
    const end = new Date(endKey + 'T23:59:59.999Z');

    const startDate = new Date(now);
    startDate.setUTCDate(startDate.getUTCDate() - days + 1);
    const startKey = startDate.toISOString().split('T')[0]!;
    const start = new Date(startKey + 'T00:00:00.000Z');

    const [mealLogs, waterLogs, target] = await Promise.all([
      this.prisma.mealLog.findMany({
        where: { userId, loggedAt: { gte: start, lte: end } },
        select: {
          loggedAt: true,
          totalCalories: true,
          totalProtein: true,
          totalCarbs: true,
          totalFat: true,
          totalFiber: true,
        },
      }),
      this.prisma.waterLog.findMany({
        where: { userId, loggedAt: { gte: start, lte: end } },
        select: { loggedAt: true, amountMl: true },
      }),
      this.prisma.target.findFirst({
        where: { userId, effectiveTo: null },
        orderBy: { effectiveFrom: 'desc' },
      }),
    ]);

    const byDate = new Map<string, DayHistory>();
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      const key = d.toISOString().split('T')[0]!;
      byDate.set(key, {
        date: key,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: null,
        waterMl: 0,
      });
    }

    for (const log of mealLogs) {
      const key = log.loggedAt.toISOString().split('T')[0]!;
      const day = byDate.get(key);
      if (day) {
        day.calories += log.totalCalories ?? 0;
        day.protein += Number(log.totalProtein ?? 0);
        day.carbs += Number(log.totalCarbs ?? 0);
        day.fat += Number(log.totalFat ?? 0);
        if (log.totalFiber !== null && log.totalFiber !== undefined) {
          day.fiber = (day.fiber ?? 0) + Number(log.totalFiber);
        }
      }
    }

    for (const log of waterLogs) {
      const key = log.loggedAt.toISOString().split('T')[0]!;
      const day = byDate.get(key);
      if (day) {
        day.waterMl += log.amountMl;
      }
    }

    const history = Array.from(byDate.values()).map((d) => ({
      date: d.date,
      calories: Math.round(d.calories),
      protein: Number(d.protein.toFixed(1)),
      carbs: Number(d.carbs.toFixed(1)),
      fat: Number(d.fat.toFixed(1)),
      fiber: d.fiber !== null ? Number(d.fiber.toFixed(1)) : null,
      waterMl: d.waterMl,
    }));

    return {
      history,
      target: target
        ? {
            calories: target.calorieTarget,
            protein: Number(target.proteinGrams),
            carbs: Number(target.carbsGrams),
            fat: Number(target.fatGrams),
          }
        : null,
    };
  }
}
