import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { CreateFoodDto, UpdateFoodDto, FoodQueryDto } from './foods.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class FoodsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFoodDto) {
    const food = await this.prisma.food.create({
      data: {
        normalizedName: dto.normalizedName,
        locale: dto.locale,
        sourceType: dto.sourceType,
        sourceRef: dto.sourceRef,
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
        barcodes: dto.barcodes
          ? {
              create: dto.barcodes.map((code) => ({ code })),
            }
          : undefined,
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

  async findMany(query: FoodQueryDto) {
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
      barcodes: true,
    } as const;
  }

  private formatFood(food: {
    id: string;
    normalizedName: string;
    locale: string;
    status: string;
    sourceType: string;
    sourceRef: string | null;
    confidence: unknown;
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
    barcodes: Array<{ id: string; code: string }>;
  }) {
    const nutrient = food.nutrients[0];
    return {
      id: food.id,
      normalizedName: food.normalizedName,
      locale: food.locale,
      status: food.status,
      sourceType: food.sourceType,
      sourceRef: food.sourceRef,
      confidence: food.confidence ? Number(food.confidence) : null,
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
      barcodes: food.barcodes.map((b) => b.code),
      createdAt: food.createdAt.toISOString(),
      updatedAt: food.updatedAt.toISOString(),
    };
  }
}
