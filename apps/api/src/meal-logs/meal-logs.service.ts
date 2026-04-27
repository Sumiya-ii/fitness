import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  dayBoundaries,
  computeItemSnapshot,
  aggregateNutritionTotals,
  FoodData,
  canonicalize,
} from '@coach/shared';
import { PrismaService } from '../prisma';
import { CalibrationService } from './calibration.service';
import {
  CreateMealLogDto,
  QuickAddDto,
  MealLogQueryDto,
  UpdateMealLogDto,
  FromVoiceDto,
} from './meal-logs.dto';

@Injectable()
export class MealLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calibration: CalibrationService,
  ) {}

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
          create: itemSnapshots.map((snapshot) => ({
            ...snapshot,
            userId,
            canonicalFoodId: canonicalize(snapshot.snapshotFoodName).id,
          })),
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
            userId,
            quantity: 1,
            servingLabel: 'Quick Add',
            gramsPerUnit: 0,
            snapshotFoodName: dto.note || 'Quick Add',
            // Best-effort: canonicalize the note. Falls back to null when
            // the note is empty, generic, or doesn't match any canonical food.
            canonicalFoodId: dto.note ? canonicalize(dto.note).id : null,
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

  /**
   * Persist a voice-log draft as a structured meal log: one MealLogItem per
   * parsed item, with foodId: null (voice items don't reference the food
   * catalog). Caller must own the draft.
   */
  async createFromVoice(userId: string, dto: FromVoiceDto) {
    const draft = await this.prisma.voiceDraft.findFirst({
      where: { id: dto.draftId, userId },
      select: { id: true, status: true, parsedItems: true },
    });

    if (!draft) throw new NotFoundException('Voice draft not found');
    if (draft.status !== 'completed') {
      throw new BadRequestException(
        `Voice draft is not ready (status=${draft.status}); cannot save as meal log`,
      );
    }

    const round1 = (n: number) => Math.round(n * 10) / 10;

    const itemRows = dto.items.map((item) => {
      const grams = item.grams > 0 ? item.grams : 0;
      const quantity = item.quantity > 0 ? item.quantity : 1;
      const gramsPerUnit = grams > 0 ? round1(grams / quantity) : 0;
      const canonical = canonicalize(item.name).id;
      return {
        userId,
        quantity,
        servingLabel: item.unit,
        gramsPerUnit,
        snapshotFoodName: item.name,
        canonicalFoodId: canonical,
        snapshotCalories: Math.round(item.calories),
        snapshotProtein: round1(item.protein),
        snapshotCarbs: round1(item.carbs),
        snapshotFat: round1(item.fat),
        snapshotFiber: item.fiber !== undefined ? round1(item.fiber) : null,
        snapshotSugar: item.sugar !== undefined ? round1(item.sugar) : null,
        snapshotSodium: item.sodium !== undefined ? round1(item.sodium) : null,
        snapshotSaturatedFat: item.saturatedFat !== undefined ? round1(item.saturatedFat) : null,
      };
    });

    const totalCalories = itemRows.reduce((s, i) => s + i.snapshotCalories, 0);
    const totalProtein = round1(itemRows.reduce((s, i) => s + Number(i.snapshotProtein), 0));
    const totalCarbs = round1(itemRows.reduce((s, i) => s + Number(i.snapshotCarbs), 0));
    const totalFat = round1(itemRows.reduce((s, i) => s + Number(i.snapshotFat), 0));
    const sumOptional = (
      key: 'snapshotFiber' | 'snapshotSugar' | 'snapshotSodium' | 'snapshotSaturatedFat',
    ) => {
      const present = itemRows.filter((r) => r[key] !== null);
      if (present.length === 0) return null;
      return round1(present.reduce((s, r) => s + Number(r[key]), 0));
    };

    const mealLog = await this.prisma.mealLog.create({
      data: {
        userId,
        mealType: dto.mealType,
        source: 'voice',
        loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
        note: dto.note,
        totalCalories,
        totalProtein,
        totalCarbs,
        totalFat,
        totalFiber: sumOptional('snapshotFiber'),
        totalSugar: sumOptional('snapshotSugar'),
        totalSodium: sumOptional('snapshotSodium'),
        totalSaturatedFat: sumOptional('snapshotSaturatedFat'),
        items: { create: itemRows },
      },
      include: { items: true },
    });

    // Best-effort calibration capture: diff each saved item against its
    // original AI estimate (matched positionally — the mobile bottom sheet
    // preserves order). Fire-and-forget; failures must not break the save.
    void this.captureVoiceCalibration(userId, draft.parsedItems, itemRows);

    return this.formatMealLog(mealLog);
  }

  /**
   * Diff voice draft estimates against the user's saved values and feed any
   * meaningful corrections to CalibrationService. Public-by-package only so
   * the spec can call it directly; not exposed via the controller.
   */
  private async captureVoiceCalibration(
    userId: string,
    rawDraftParsed: unknown,
    savedRows: Array<{ canonicalFoodId: string | null; snapshotCalories: number }>,
  ): Promise<void> {
    // Draft envelope can be { items, clarification? } or a bare array (legacy).
    const draftItems: Array<{ name?: string; calories?: number }> = Array.isArray(rawDraftParsed)
      ? (rawDraftParsed as Array<{ name?: string; calories?: number }>)
      : Array.isArray((rawDraftParsed as { items?: unknown })?.items)
        ? (rawDraftParsed as { items: Array<{ name?: string; calories?: number }> }).items
        : [];

    if (draftItems.length === 0 || draftItems.length !== savedRows.length) return;

    const entries = savedRows.map((row, i) => ({
      canonicalFoodId: row.canonicalFoodId,
      originalKcal: typeof draftItems[i]?.calories === 'number' ? draftItems[i].calories! : 0,
      correctedKcal: row.snapshotCalories,
    }));

    await this.calibration.recordCorrections(userId, entries);
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
      const { dayStart, dayEnd } = dayBoundaries(query.date, query.tz);
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
      canonicalFoodId?: string | null;
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
        canonicalFoodId: item.canonicalFoodId ?? null,
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
