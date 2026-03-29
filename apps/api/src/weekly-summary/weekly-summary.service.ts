import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma';

export interface WeeklySummaryResult {
  weekStart: string;
  weekEnd: string;
  daysLogged: number;
  averageCalories: number;
  averageProtein: number;
  averageCarbs: number;
  averageFat: number;
  adherenceScore: number;
  weightStart: number | null;
  weightEnd: number | null;
  weightDelta: number | null;
}

@Injectable()
export class WeeklySummaryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the Monday of the week containing the given date.
   * Week is Monday–Sunday.
   */
  private getMondayOfWeek(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    d.setDate(d.getDate() - daysToMonday);
    return d;
  }

  async getWeeklySummary(userId: string, weekStartDate?: string): Promise<WeeklySummaryResult> {
    const baseDate = weekStartDate
      ? (() => {
          const [y, m, d] = weekStartDate.split('-').map(Number);
          return new Date(y, m - 1, d);
        })()
      : new Date();
    const weekStart = this.getMondayOfWeek(baseDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const [mealLogs, weightLogs] = await Promise.all([
      this.prisma.mealLog.findMany({
        where: {
          userId,
          loggedAt: { gte: weekStart, lt: weekEnd },
        },
        select: {
          loggedAt: true,
          totalCalories: true,
          totalProtein: true,
          totalCarbs: true,
          totalFat: true,
        },
      }),
      this.prisma.weightLog.findMany({
        where: {
          userId,
          loggedAt: { gte: weekStart, lt: weekEnd },
        },
        orderBy: { loggedAt: 'asc' },
      }),
    ]);

    const dayTotals = new Map<
      string,
      { calories: number; protein: number; carbs: number; fat: number }
    >();

    for (const log of mealLogs) {
      const dayKey = log.loggedAt.toISOString().split('T')[0];
      const existing = dayTotals.get(dayKey) ?? {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      };
      existing.calories += log.totalCalories ?? 0;
      existing.protein += Number(log.totalProtein ?? 0);
      existing.carbs += Number(log.totalCarbs ?? 0);
      existing.fat += Number(log.totalFat ?? 0);
      dayTotals.set(dayKey, existing);
    }

    const daysLogged = dayTotals.size;
    const totalCalories = [...dayTotals.values()].reduce((s, d) => s + d.calories, 0);
    const totalProtein = [...dayTotals.values()].reduce((s, d) => s + d.protein, 0);
    const totalCarbs = [...dayTotals.values()].reduce((s, d) => s + d.carbs, 0);
    const totalFat = [...dayTotals.values()].reduce((s, d) => s + d.fat, 0);

    const averageCalories = daysLogged > 0 ? Math.round(totalCalories / daysLogged) : 0;
    const averageProtein = daysLogged > 0 ? Number((totalProtein / daysLogged).toFixed(1)) : 0;
    const averageCarbs = daysLogged > 0 ? Number((totalCarbs / daysLogged).toFixed(1)) : 0;
    const averageFat = daysLogged > 0 ? Number((totalFat / daysLogged).toFixed(1)) : 0;

    const adherenceScore = Number(((daysLogged / 7) * 100).toFixed(1));

    let weightStart: number | null = null;
    let weightEnd: number | null = null;
    let weightDelta: number | null = null;

    if (weightLogs.length > 0) {
      weightStart = Number(weightLogs[0].weightKg);
      weightEnd = Number(weightLogs[weightLogs.length - 1].weightKg);
      weightDelta = Number((weightEnd - weightStart).toFixed(1));
    }

    const weekEndDate = new Date(weekEnd);
    weekEndDate.setDate(weekEndDate.getDate() - 1);

    return {
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEndDate.toISOString().split('T')[0],
      daysLogged,
      averageCalories,
      averageProtein,
      averageCarbs,
      averageFat,
      adherenceScore,
      weightStart,
      weightEnd,
      weightDelta,
    };
  }
}
