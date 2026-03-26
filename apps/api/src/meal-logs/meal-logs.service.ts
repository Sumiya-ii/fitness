import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { CreateMealLogDto, QuickAddDto, MealLogQueryDto, UpdateMealLogDto } from './meal-logs.dto';

@Injectable()
export class MealLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async createFromFood(userId: string, dto: CreateMealLogDto) {
    const foodIds = dto.items.map((i) => i.foodId);

    // Single batched query instead of N per-item lookups
    const foods = await this.prisma.food.findMany({
      where: { id: { in: foodIds } },
      include: { servings: true, nutrients: true },
    });

    const foodMap = new Map(foods.map((f) => [f.id, f]));

    const itemSnapshots = dto.items.map((item) => {
      const food = foodMap.get(item.foodId);
      if (!food) throw new NotFoundException(`Food ${item.foodId} not found`);

      const serving = food.servings.find((s) => s.id === item.servingId);
      if (!serving)
        throw new BadRequestException(
          `Serving ${item.servingId} not found for food ${item.foodId}`,
        );

      const nutrient = food.nutrients[0];
      if (!nutrient) throw new BadRequestException(`Food ${item.foodId} has no nutrient data`);

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
        snapshotFiber:
          nutrient.fiberPer100g !== null && nutrient.fiberPer100g !== undefined
            ? Number((Number(nutrient.fiberPer100g) * factor).toFixed(2))
            : null,
        snapshotSugar:
          nutrient.sugarPer100g !== null && nutrient.sugarPer100g !== undefined
            ? Number((Number(nutrient.sugarPer100g) * factor).toFixed(2))
            : null,
        snapshotSodium:
          nutrient.sodiumPer100g !== null && nutrient.sodiumPer100g !== undefined
            ? Number((Number(nutrient.sodiumPer100g) * factor).toFixed(2))
            : null,
        snapshotSaturatedFat:
          nutrient.saturatedFatPer100g !== null && nutrient.saturatedFatPer100g !== undefined
            ? Number((Number(nutrient.saturatedFatPer100g) * factor).toFixed(2))
            : null,
      };
    });

    const totalCalories = itemSnapshots.reduce((sum, i) => sum + i.snapshotCalories, 0);
    // Round after summing to prevent float accumulation (e.g. 5.40 + 2.70 → 8.100000000000001)
    const totalProtein = Number(
      itemSnapshots.reduce((sum, i) => sum + i.snapshotProtein, 0).toFixed(2),
    );
    const totalCarbs = Number(
      itemSnapshots.reduce((sum, i) => sum + i.snapshotCarbs, 0).toFixed(2),
    );
    const totalFat = Number(itemSnapshots.reduce((sum, i) => sum + i.snapshotFat, 0).toFixed(2));
    const totalFiber = itemSnapshots.some((i) => i.snapshotFiber !== null)
      ? Number(itemSnapshots.reduce((sum, i) => sum + (i.snapshotFiber ?? 0), 0).toFixed(2))
      : null;
    const totalSugar = itemSnapshots.some((i) => i.snapshotSugar !== null)
      ? Number(itemSnapshots.reduce((sum, i) => sum + (i.snapshotSugar ?? 0), 0).toFixed(2))
      : null;
    const totalSodium = itemSnapshots.some((i) => i.snapshotSodium !== null)
      ? Number(itemSnapshots.reduce((sum, i) => sum + (i.snapshotSodium ?? 0), 0).toFixed(2))
      : null;
    const totalSaturatedFat = itemSnapshots.some((i) => i.snapshotSaturatedFat !== null)
      ? Number(itemSnapshots.reduce((sum, i) => sum + (i.snapshotSaturatedFat ?? 0), 0).toFixed(2))
      : null;

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
        totalFiber,
        totalSugar,
        totalSodium,
        totalSaturatedFat,
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
        totalFiber: dto.fiberGrams ?? null,
        totalSugar: dto.sugarGrams ?? null,
        totalSodium: dto.sodiumMg ?? null,
        totalSaturatedFat: dto.saturatedFatGrams ?? null,
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
            snapshotFiber: dto.fiberGrams ?? null,
            snapshotSugar: dto.sugarGrams ?? null,
            snapshotSodium: dto.sodiumMg ?? null,
            snapshotSaturatedFat: dto.saturatedFatGrams ?? null,
          },
        },
      },
      include: { items: true },
    });

    return this.formatMealLog(mealLog);
  }

  async update(userId: string, id: string, dto: UpdateMealLogDto) {
    const log = await this.prisma.mealLog.findFirst({ where: { id, userId } });
    if (!log) throw new NotFoundException('Meal log not found');

    const updated = await this.prisma.mealLog.update({
      where: { id },
      data: {
        ...(dto.mealType !== undefined && { mealType: dto.mealType }),
        ...(dto.note !== undefined && { note: dto.note }),
        ...(dto.loggedAt !== undefined && { loggedAt: new Date(dto.loggedAt) }),
      },
      include: { items: true },
    });

    return this.formatMealLog(updated);
  }

  async findByUser(userId: string, query: MealLogQueryDto) {
    const where: { userId: string; loggedAt?: { gte: Date; lt: Date } } = { userId };

    if (query.date) {
      // Parse as UTC to avoid server-timezone day-boundary drift
      const dayStart = new Date(query.date + 'T00:00:00.000Z');
      const dayEnd = new Date(query.date + 'T00:00:00.000Z');
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
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
    totalFiber: unknown;
    totalSugar: unknown;
    totalSodium: unknown;
    totalSaturatedFat: unknown;
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
      snapshotFiber: unknown;
      snapshotSugar: unknown;
      snapshotSodium: unknown;
      snapshotSaturatedFat: unknown;
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
      totalFiber:
        log.totalFiber !== null && log.totalFiber !== undefined ? Number(log.totalFiber) : null,
      totalSugar:
        log.totalSugar !== null && log.totalSugar !== undefined ? Number(log.totalSugar) : null,
      totalSodium:
        log.totalSodium !== null && log.totalSodium !== undefined ? Number(log.totalSodium) : null,
      totalSaturatedFat:
        log.totalSaturatedFat !== null && log.totalSaturatedFat !== undefined
          ? Number(log.totalSaturatedFat)
          : null,
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
        snapshotFiber:
          item.snapshotFiber !== null && item.snapshotFiber !== undefined
            ? Number(item.snapshotFiber)
            : null,
        snapshotSugar:
          item.snapshotSugar !== null && item.snapshotSugar !== undefined
            ? Number(item.snapshotSugar)
            : null,
        snapshotSodium:
          item.snapshotSodium !== null && item.snapshotSodium !== undefined
            ? Number(item.snapshotSodium)
            : null,
        snapshotSaturatedFat:
          item.snapshotSaturatedFat !== null && item.snapshotSaturatedFat !== undefined
            ? Number(item.snapshotSaturatedFat)
            : null,
      })),
      createdAt: log.createdAt.toISOString(),
      updatedAt: log.updatedAt.toISOString(),
    };
  }
}
