import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma';
import { CreateFoodDto, UpdateFoodDto, FoodQueryDto } from './foods.dto';

@Injectable()
export class FoodsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFoodDto) {
    const food = await this.prisma.food.create({
      data: {
        normalizedName: dto.normalizedName,
        locale: dto.locale,
        sourceType: dto.sourceType,
        status: dto.sourceType === 'admin' ? 'approved' : 'pending',
        servings: {
          create: dto.servings.map((s) => ({
            label: s.label,
            labelMn: s.labelMn,
            gramsPerUnit: s.gramsPerUnit,
            isDefault: s.isDefault ?? false,
          })),
        },
        nutrients: {
          create: {
            caloriesPer100g: dto.nutrients.caloriesPer100g,
            proteinPer100g: dto.nutrients.proteinPer100g,
            carbsPer100g: dto.nutrients.carbsPer100g,
            fatPer100g: dto.nutrients.fatPer100g,
            fiberPer100g: dto.nutrients.fiberPer100g,
            sugarPer100g: dto.nutrients.sugarPer100g,
            sodiumPer100g: dto.nutrients.sodiumPer100g,
            saturatedFatPer100g: dto.nutrients.saturatedFatPer100g,
          },
        },
        localizations: dto.localizations ? { create: dto.localizations } : undefined,
        aliases: dto.aliases ? { create: dto.aliases } : undefined,
      },
      include: this.fullInclude(),
    });

    return this.formatFood(food);
  }

  async findById(id: string) {
    const food = await this.prisma.food.findUnique({
      where: { id },
      include: this.fullInclude(),
    });

    if (!food) throw new NotFoundException('Food not found');
    return this.formatFood(food);
  }

  async findMany(query: FoodQueryDto, userId?: string) {
    // When a search term is present and we have an authenticated user, boost
    // results by the number of times the user has logged each food in the last
    // 90 days. Prisma's findMany cannot express a lateral subquery ORDER BY, so
    // we use $queryRaw for the ranked search path and cap results at 20.
    if (query.search && userId) {
      return this.findManyRanked(query, userId);
    }

    const where: Prisma.FoodWhereInput = {};
    if (query.locale) where.locale = query.locale;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { normalizedName: { contains: query.search, mode: 'insensitive' } },
        { aliases: { some: { alias: { contains: query.search, mode: 'insensitive' } } } },
        { localizations: { some: { name: { contains: query.search, mode: 'insensitive' } } } },
      ];
    }

    const [foods, total] = await Promise.all([
      this.prisma.food.findMany({
        where,
        include: this.fullInclude(),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { normalizedName: 'asc' },
      }),
      this.prisma.food.count({ where }),
    ]);

    return {
      data: foods.map((f) => this.formatFood(f)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * Full-text search with per-user usage frequency boost.
   *
   * Executes a single $queryRaw that LEFT JOINs `meal_log_items` for the
   * requesting user over the last 90 days and orders by (usage_count DESC,
   * normalized_name ASC). Results are always capped at 20 rows.
   *
   * Returns the same envelope shape as `findMany` but with a fixed limit of 20
   * and no pagination (offset search with usage boost doesn't compose cleanly
   * with cursor pagination).
   */
  private async findManyRanked(query: FoodQueryDto, userId: string) {
    const search = `%${query.search!.toLowerCase()}%`;
    const localeFilter = query.locale ?? null;
    const statusFilter = query.status ?? null;
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Raw query: match foods by name/alias/localization, left-join usage counts,
    // order by usage desc then name asc, hard-cap at 20.
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT f.id
      FROM foods f
      LEFT JOIN (
        SELECT food_id, COUNT(*)::int AS usage_count
        FROM meal_log_items
        WHERE user_id::text = ${userId}
          AND food_id IS NOT NULL
          AND created_at >= ${since}
        GROUP BY food_id
      ) usage ON usage.food_id = f.id
      WHERE (
        LOWER(f.normalized_name) LIKE ${search}
        OR EXISTS (
          SELECT 1 FROM food_aliases fa
          WHERE fa.food_id = f.id AND LOWER(fa.alias) LIKE ${search}
        )
        OR EXISTS (
          SELECT 1 FROM food_localizations fl
          WHERE fl.food_id = f.id AND LOWER(fl.name) LIKE ${search}
        )
      )
      ${localeFilter !== null ? Prisma.sql`AND f.locale = ${localeFilter}` : Prisma.empty}
      ${statusFilter !== null ? Prisma.sql`AND f.status = ${statusFilter}` : Prisma.empty}
      ORDER BY COALESCE(usage.usage_count, 0) DESC, f.normalized_name ASC
      LIMIT 20
    `;

    if (rows.length === 0) {
      return { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
    }

    const ids = rows.map((r) => r.id);
    const foods = await this.prisma.food.findMany({
      where: { id: { in: ids } },
      include: this.fullInclude(),
    });

    // Restore the SQL order
    const foodMap = new Map(foods.map((f) => [f.id, f]));
    const ordered = ids.map((id) => foodMap.get(id)!).filter(Boolean);

    return {
      data: ordered.map((f) => this.formatFood(f)),
      meta: { total: ordered.length, page: 1, limit: 20, totalPages: 1 },
    };
  }

  async update(id: string, dto: UpdateFoodDto) {
    await this.findById(id);

    await this.prisma.food.update({
      where: { id },
      data: {
        ...(dto.normalizedName !== undefined && {
          normalizedName: dto.normalizedName,
        }),
        ...(dto.locale !== undefined && { locale: dto.locale }),
      },
    });

    if (dto.nutrients) {
      await this.prisma.foodNutrient.updateMany({
        where: { foodId: id },
        data: {
          caloriesPer100g: dto.nutrients.caloriesPer100g,
          proteinPer100g: dto.nutrients.proteinPer100g,
          carbsPer100g: dto.nutrients.carbsPer100g,
          fatPer100g: dto.nutrients.fatPer100g,
          fiberPer100g: dto.nutrients.fiberPer100g,
          sugarPer100g: dto.nutrients.sugarPer100g,
          sodiumPer100g: dto.nutrients.sodiumPer100g,
          saturatedFatPer100g: dto.nutrients.saturatedFatPer100g,
        },
      });
    }

    if (dto.servings) {
      await this.prisma.foodServing.deleteMany({ where: { foodId: id } });
      await this.prisma.foodServing.createMany({
        data: dto.servings.map((s) => ({
          foodId: id,
          label: s.label,
          labelMn: s.labelMn,
          gramsPerUnit: s.gramsPerUnit,
          isDefault: s.isDefault ?? false,
        })),
      });
    }

    if (dto.localizations) {
      await this.prisma.foodLocalization.deleteMany({ where: { foodId: id } });
      await this.prisma.foodLocalization.createMany({
        data: dto.localizations.map((l) => ({
          foodId: id,
          locale: l.locale,
          name: l.name,
        })),
      });
    }

    if (dto.aliases) {
      await this.prisma.foodAlias.deleteMany({ where: { foodId: id } });
      await this.prisma.foodAlias.createMany({
        data: dto.aliases.map((a) => ({
          foodId: id,
          alias: a.alias,
          locale: a.locale,
        })),
      });
    }

    return this.findById(id);
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.food.delete({ where: { id } });
  }

  private fullInclude() {
    return {
      servings: true,
      nutrients: true,
      aliases: true,
      localizations: true,
    } as const;
  }

  private formatFood(food: {
    id: string;
    normalizedName: string;
    locale: string;
    status: string;
    sourceType: string;
    createdAt: Date;
    updatedAt: Date;
    servings: Array<{
      id: string;
      label: string;
      labelMn: string | null;
      gramsPerUnit: unknown;
      isDefault: boolean;
    }>;
    nutrients: Array<{
      id: string;
      caloriesPer100g: unknown;
      proteinPer100g: unknown;
      carbsPer100g: unknown;
      fatPer100g: unknown;
      fiberPer100g: unknown;
      sugarPer100g: unknown;
      sodiumPer100g: unknown;
      saturatedFatPer100g: unknown;
    }>;
    aliases: Array<{ id: string; alias: string; locale: string }>;
    localizations: Array<{ id: string; locale: string; name: string }>;
  }) {
    const nutrient = food.nutrients[0];
    return {
      id: food.id,
      normalizedName: food.normalizedName,
      locale: food.locale,
      status: food.status,
      sourceType: food.sourceType,
      servings: food.servings.map((s) => ({
        id: s.id,
        label: s.label,
        labelMn: s.labelMn,
        gramsPerUnit: Number(s.gramsPerUnit),
        isDefault: s.isDefault,
      })),
      nutrients: nutrient
        ? {
            caloriesPer100g: Number(nutrient.caloriesPer100g),
            proteinPer100g: Number(nutrient.proteinPer100g),
            carbsPer100g: Number(nutrient.carbsPer100g),
            fatPer100g: Number(nutrient.fatPer100g),
            fiberPer100g: nutrient.fiberPer100g ? Number(nutrient.fiberPer100g) : null,
            sugarPer100g: nutrient.sugarPer100g ? Number(nutrient.sugarPer100g) : null,
            sodiumPer100g: nutrient.sodiumPer100g ? Number(nutrient.sodiumPer100g) : null,
            saturatedFatPer100g: nutrient.saturatedFatPer100g
              ? Number(nutrient.saturatedFatPer100g)
              : null,
          }
        : null,
      aliases: food.aliases.map((a) => ({
        id: a.id,
        alias: a.alias,
        locale: a.locale,
      })),
      localizations: food.localizations.map((l) => ({
        id: l.id,
        locale: l.locale,
        name: l.name,
      })),
      createdAt: food.createdAt.toISOString(),
      updatedAt: food.updatedAt.toISOString(),
    };
  }
}
