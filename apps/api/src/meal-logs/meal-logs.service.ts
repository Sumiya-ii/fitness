import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { CreateMealLogDto, QuickAddDto, MealLogQueryDto } from './meal-logs.dto';

@Injectable()
export class MealLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async createFromFood(userId: string, dto: CreateMealLogDto) {
    const itemSnapshots = await Promise.all(
      dto.items.map(async (item) => {
        const food = await this.prisma.food.findUnique({
          where: { id: item.foodId },
          include: { servings: true, nutrients: true },
        });

        if (!food) throw new NotFoundException(`Food ${item.foodId} not found`);

        const serving = food.servings.find((s) => s.id === item.servingId);
        if (!serving)
          throw new BadRequestException(
            `Serving ${item.servingId} not found for food ${item.foodId}`,
          );

        const nutrient = food.nutrients[0];
        if (!nutrient)
          throw new BadRequestException(`Food ${item.foodId} has no nutrient data`);

        const totalGrams = Number(serving.gramsPerUnit) * item.quantity;
        const factor = totalGrams / 100;

        return {
          foodId: food.id,
          quantity: item.quantity,
          servingLabel: serving.label,
          gramsPerUnit: Number(serving.gramsPerUnit),
          snapshotFoodName: food.normalizedName,
          snapshotCalories: Math.round(Number(nutrient.caloriesPer100g) * factor),
          snapshotProtein: Number((Number(nutrient.proteinPer100g) * factor).toFixed(2)),
          snapshotCarbs: Number((Number(nutrient.carbsPer100g) * factor).toFixed(2)),
          snapshotFat: Number((Number(nutrient.fatPer100g) * factor).toFixed(2)),
        };
      }),
    );

    const totalCalories = itemSnapshots.reduce((sum, i) => sum + i.snapshotCalories, 0);
    const totalProtein = itemSnapshots.reduce((sum, i) => sum + i.snapshotProtein, 0);
    const totalCarbs = itemSnapshots.reduce((sum, i) => sum + i.snapshotCarbs, 0);
    const totalFat = itemSnapshots.reduce((sum, i) => sum + i.snapshotFat, 0);

    const mealLog = await this.prisma.mealLog.create({
      data: {
        userId,
        mealType: dto.mealType,
        source: dto.source,
        loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
        note: dto.note,
        totalCalories,
        totalProtein,
        totalCarbs,
        totalFat,
        items: {
          create: itemSnapshots,
        },
      },
      include: { items: true },
    });

    return this.formatMealLog(mealLog);
  }

  async quickAdd(userId: string, dto: QuickAddDto) {
    const mealLog = await this.prisma.mealLog.create({
      data: {
        userId,
        mealType: dto.mealType,
        source: dto.source ?? 'quick_add',
        loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
        note: dto.note,
        totalCalories: dto.calories,
        totalProtein: dto.proteinGrams,
        totalCarbs: dto.carbsGrams,
        totalFat: dto.fatGrams,
        items: {
          create: {
            quantity: 1,
            servingLabel: 'Quick Add',
            gramsPerUnit: 0,
            snapshotFoodName: dto.note || 'Quick Add',
            snapshotCalories: dto.calories,
            snapshotProtein: dto.proteinGrams,
            snapshotCarbs: dto.carbsGrams,
            snapshotFat: dto.fatGrams,
          },
        },
      },
      include: { items: true },
    });

    return this.formatMealLog(mealLog);
  }

  async findByUser(userId: string, query: MealLogQueryDto) {
    const where: { userId: string; loggedAt?: { gte: Date; lt: Date } } = { userId };

    if (query.date) {
      const dayStart = new Date(query.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      where.loggedAt = { gte: dayStart, lt: dayEnd };
    }

    const [logs, total] = await Promise.all([
      this.prisma.mealLog.findMany({
        where,
        include: { items: true },
        orderBy: { loggedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.mealLog.count({ where }),
    ]);

    return {
      data: logs.map((l) => this.formatMealLog(l)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findById(userId: string, id: string) {
    const log = await this.prisma.mealLog.findFirst({
      where: { id, userId },
      include: { items: true },
    });

    if (!log) throw new NotFoundException('Meal log not found');
    return this.formatMealLog(log);
  }

  async remove(userId: string, id: string) {
    const log = await this.prisma.mealLog.findFirst({
      where: { id, userId },
    });
    if (!log) throw new NotFoundException('Meal log not found');
    await this.prisma.mealLog.delete({ where: { id } });
  }

  private formatMealLog(log: {
    id: string;
    userId: string;
    mealType: string | null;
    source: string;
    loggedAt: Date;
    note: string | null;
    totalCalories: number | null;
    totalProtein: unknown;
    totalCarbs: unknown;
    totalFat: unknown;
    createdAt: Date;
    updatedAt: Date;
    items: Array<{
      id: string;
      foodId: string | null;
      quantity: unknown;
      servingLabel: string;
      gramsPerUnit: unknown;
      snapshotCalories: number;
      snapshotProtein: unknown;
      snapshotCarbs: unknown;
      snapshotFat: unknown;
      snapshotFoodName: string;
      createdAt: Date;
    }>;
  }) {
    return {
      id: log.id,
      userId: log.userId,
      mealType: log.mealType,
      source: log.source,
      loggedAt: log.loggedAt.toISOString(),
      note: log.note,
      totalCalories: log.totalCalories,
      totalProtein: log.totalProtein ? Number(log.totalProtein) : 0,
      totalCarbs: log.totalCarbs ? Number(log.totalCarbs) : 0,
      totalFat: log.totalFat ? Number(log.totalFat) : 0,
      items: log.items.map((item) => ({
        id: item.id,
        foodId: item.foodId,
        quantity: Number(item.quantity),
        servingLabel: item.servingLabel,
        gramsPerUnit: Number(item.gramsPerUnit),
        snapshotFoodName: item.snapshotFoodName,
        snapshotCalories: item.snapshotCalories,
        snapshotProtein: Number(item.snapshotProtein),
        snapshotCarbs: Number(item.snapshotCarbs),
        snapshotFat: Number(item.snapshotFat),
      })),
      createdAt: log.createdAt.toISOString(),
      updatedAt: log.updatedAt.toISOString(),
    };
  }
}
