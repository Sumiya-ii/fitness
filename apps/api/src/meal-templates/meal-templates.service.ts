import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { computeItemSnapshot, aggregateNutritionTotals, FoodData } from '@coach/shared';
import { PrismaService } from '../prisma';
import {
  CreateTemplateDto,
  CreateFromLogDto,
  UpdateTemplateDto,
  LogTemplateDto,
  TemplateQueryDto,
} from './meal-templates.dto';

@Injectable()
export class MealTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateTemplateDto) {
    const template = await this.prisma.mealTemplate.create({
      data: {
        userId,
        name: dto.name,
        mealType: dto.mealType,
        items: {
          create: dto.items.map((item, index) => ({
            foodId: item.foodId,
            servingId: item.servingId,
            quantity: item.quantity,
            sortOrder: item.sortOrder ?? index,
          })),
        },
      },
      include: { items: { include: { food: true, serving: true }, orderBy: { sortOrder: 'asc' } } },
    });

    return this.formatTemplate(template);
  }

  async createFromLog(userId: string, mealLogId: string, dto: CreateFromLogDto) {
    const mealLog = await this.prisma.mealLog.findFirst({
      where: { id: mealLogId, userId },
      include: { items: true },
    });

    if (!mealLog) throw new NotFoundException('Meal log not found');

    // Filter items that have a foodId (skip quick-add items)
    const validItems = mealLog.items.filter((item) => item.foodId !== null);
    if (validItems.length === 0) {
      throw new BadRequestException('Meal log has no food items to save as template');
    }

    // Look up the current default serving for each food to get servingId
    const foodIds = validItems.map((item) => item.foodId!);
    const foods = await this.prisma.food.findMany({
      where: { id: { in: foodIds } },
      include: { servings: true },
    });
    const foodMap = new Map(foods.map((f) => [f.id, f]));

    const templateItems = validItems.map((item, index) => {
      const food = foodMap.get(item.foodId!);
      if (!food) throw new BadRequestException(`Food ${item.foodId} no longer exists`);

      // Try to match by gramsPerUnit + label, fall back to default, then first serving
      const serving =
        food.servings.find(
          (s) =>
            Number(s.gramsPerUnit) === Number(item.gramsPerUnit) && s.label === item.servingLabel,
        ) ??
        food.servings.find((s) => s.isDefault) ??
        food.servings[0];

      if (!serving) throw new BadRequestException(`Food ${food.normalizedName} has no servings`);

      return {
        foodId: item.foodId!,
        servingId: serving.id,
        quantity: Number(item.quantity),
        sortOrder: index,
      };
    });

    const template = await this.prisma.mealTemplate.create({
      data: {
        userId,
        name: dto.name,
        mealType: dto.mealType ?? mealLog.mealType,
        items: { create: templateItems },
      },
      include: { items: { include: { food: true, serving: true }, orderBy: { sortOrder: 'asc' } } },
    });

    return this.formatTemplate(template);
  }

  async findByUser(userId: string, query: TemplateQueryDto) {
    const where = { userId };

    const [templates, total] = await Promise.all([
      this.prisma.mealTemplate.findMany({
        where,
        include: {
          items: { include: { food: true, serving: true }, orderBy: { sortOrder: 'asc' } },
        },
        orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.mealTemplate.count({ where }),
    ]);

    return {
      data: templates.map((t) => this.formatTemplate(t)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findById(userId: string, id: string) {
    const template = await this.prisma.mealTemplate.findFirst({
      where: { id, userId },
      include: {
        items: {
          include: { food: { include: { nutrients: true, servings: true } }, serving: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!template) throw new NotFoundException('Meal template not found');
    return this.formatTemplateDetail(template);
  }

  async update(userId: string, id: string, dto: UpdateTemplateDto) {
    const existing = await this.prisma.mealTemplate.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Meal template not found');

    // If items are provided, replace all items
    if (dto.items) {
      await this.prisma.mealTemplateItem.deleteMany({ where: { templateId: id } });
    }

    const template = await this.prisma.mealTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.mealType !== undefined && { mealType: dto.mealType }),
        ...(dto.items && {
          items: {
            create: dto.items.map((item, index) => ({
              foodId: item.foodId,
              servingId: item.servingId,
              quantity: item.quantity,
              sortOrder: item.sortOrder ?? index,
            })),
          },
        }),
      },
      include: { items: { include: { food: true, serving: true }, orderBy: { sortOrder: 'asc' } } },
    });

    return this.formatTemplate(template);
  }

  async remove(userId: string, id: string) {
    const template = await this.prisma.mealTemplate.findFirst({ where: { id, userId } });
    if (!template) throw new NotFoundException('Meal template not found');
    await this.prisma.mealTemplate.delete({ where: { id } });
  }

  async logTemplate(userId: string, id: string, dto: LogTemplateDto) {
    const template = await this.prisma.mealTemplate.findFirst({
      where: { id, userId },
    });
    if (!template) throw new NotFoundException('Meal template not found');

    // Look up all foods and their nutrition data
    const foodIds = dto.items.map((i) => i.foodId);
    const foods = await this.prisma.food.findMany({
      where: { id: { in: foodIds } },
      include: { servings: true, nutrients: true },
    });
    const foodMap = new Map(foods.map((f) => [f.id, f]));

    const itemSnapshots = dto.items.map((item) => {
      const food = foodMap.get(item.foodId);
      if (!food) throw new NotFoundException(`Food ${item.foodId} not found`);

      try {
        return computeItemSnapshot(food as FoodData, item.servingId, item.quantity);
      } catch (e) {
        throw new BadRequestException((e as Error).message);
      }
    });

    const {
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFat,
      totalFiber,
      totalSugar,
      totalSodium,
      totalSaturatedFat,
    } = aggregateNutritionTotals(itemSnapshots);

    // Create meal log and bump template usage in a transaction
    const [mealLog] = await this.prisma.$transaction([
      this.prisma.mealLog.create({
        data: {
          userId,
          mealType: dto.mealType ?? template.mealType,
          source: 'text',
          loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
          note: dto.note ?? `From template: ${template.name}`,
          totalCalories,
          totalProtein,
          totalCarbs,
          totalFat,
          totalFiber,
          totalSugar,
          totalSodium,
          totalSaturatedFat,
          items: { create: itemSnapshots.map((snapshot) => ({ ...snapshot, userId })) },
        },
        include: { items: true },
      }),
      this.prisma.mealTemplate.update({
        where: { id },
        data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
      }),
    ]);

    return this.formatMealLog(mealLog);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatTemplate(template: any) {
    return {
      id: template.id,
      name: template.name,
      mealType: template.mealType,
      usageCount: template.usageCount,
      lastUsedAt: template.lastUsedAt?.toISOString() ?? null,
      createdAt: template.createdAt.toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: template.items.map((item: any) => ({
        id: item.id,
        foodId: item.foodId,
        foodName: item.food.normalizedName,
        servingId: item.servingId,
        servingLabel: item.serving.label,
        gramsPerUnit: Number(item.serving.gramsPerUnit),
        quantity: Number(item.quantity),
        sortOrder: item.sortOrder,
      })),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatTemplateDetail(template: any) {
    return {
      id: template.id,
      name: template.name,
      mealType: template.mealType,
      usageCount: template.usageCount,
      lastUsedAt: template.lastUsedAt?.toISOString() ?? null,
      createdAt: template.createdAt.toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: template.items.map((item: any) => {
        const nutrient = item.food.nutrients?.[0];
        const totalGrams = Number(item.serving.gramsPerUnit) * Number(item.quantity);
        const factor = totalGrams / 100;

        return {
          id: item.id,
          foodId: item.foodId,
          foodName: item.food.normalizedName,
          servingId: item.servingId,
          servingLabel: item.serving.label,
          gramsPerUnit: Number(item.serving.gramsPerUnit),
          quantity: Number(item.quantity),
          sortOrder: item.sortOrder,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          servings: item.food.servings.map((s: any) => ({
            id: s.id,
            label: s.label,
            gramsPerUnit: Number(s.gramsPerUnit),
            isDefault: s.isDefault,
          })),
          estimatedNutrition: nutrient
            ? {
                calories: Math.round(Number(nutrient.caloriesPer100g) * factor),
                protein: Number((Number(nutrient.proteinPer100g) * factor).toFixed(2)),
                carbs: Number((Number(nutrient.carbsPer100g) * factor).toFixed(2)),
                fat: Number((Number(nutrient.fatPer100g) * factor).toFixed(2)),
              }
            : null,
        };
      }),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatMealLog(log: any) {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: log.items.map((item: any) => ({
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
