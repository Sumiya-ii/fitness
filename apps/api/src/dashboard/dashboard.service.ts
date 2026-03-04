import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDailyDashboard(userId: string, dateStr?: string) {
    const date = dateStr ? new Date(dateStr) : new Date();
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const [mealLogs, target] = await Promise.all([
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
    ]);

    const consumed = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };

    for (const log of mealLogs) {
      consumed.calories += log.totalCalories ?? 0;
      consumed.protein += Number(log.totalProtein ?? 0);
      consumed.carbs += Number(log.totalCarbs ?? 0);
      consumed.fat += Number(log.totalFat ?? 0);
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
          percentage: Number(
            Math.min(100, (consumed.protein / targets.protein) * 100).toFixed(1),
          ),
        }
      : null;

    const meals = mealLogs.map((log) => ({
      id: log.id,
      mealType: log.mealType ?? 'snack',
      totalCalories: log.totalCalories ?? 0,
      totalProtein: Number(log.totalProtein ?? 0),
      totalCarbs: Number(log.totalCarbs ?? 0),
      totalFat: Number(log.totalFat ?? 0),
      loggedAt: log.loggedAt.toISOString(),
      items: log.items.map((item) => ({
        id: item.id,
        snapshotFoodName: item.snapshotFoodName,
        snapshotCalories: item.snapshotCalories,
      })),
    }));

    return {
      date: dayStart.toISOString().split('T')[0],
      consumed,
      targets,
      remaining,
      proteinProgress,
      mealCount: mealLogs.length,
      meals,
    };
  }
}
