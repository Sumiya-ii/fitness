import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { SubmitBarcodeDto } from './barcodes.dto';

@Injectable()
export class BarcodesService {
  constructor(private readonly prisma: PrismaService) {}

  async lookup(code: string) {
    const barcode = await this.prisma.barcode.findUnique({
      where: { code },
      include: {
        food: {
          include: {
            servings: true,
            nutrients: true,
            localizations: true,
          },
        },
      },
    });

    if (!barcode) throw new NotFoundException('Barcode not found');

    const food = barcode.food;
    const nutrient = food.nutrients[0];

    return {
      code: barcode.code,
      food: {
        id: food.id,
        name: food.normalizedName,
        locale: food.locale,
        servings: food.servings.map((s) => ({
          id: s.id,
          label: s.label,
          gramsPerUnit: Number(s.gramsPerUnit),
          isDefault: s.isDefault,
        })),
        nutrients: nutrient
          ? {
              caloriesPer100g: Number(nutrient.caloriesPer100g),
              proteinPer100g: Number(nutrient.proteinPer100g),
              carbsPer100g: Number(nutrient.carbsPer100g),
              fatPer100g: Number(nutrient.fatPer100g),
            }
          : null,
        localizations: food.localizations.map((l) => ({
          locale: l.locale,
          name: l.name,
        })),
      },
    };
  }

  async submitUnknown(userId: string, dto: SubmitBarcodeDto) {
    const existing = await this.prisma.barcode.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      return { status: 'already_exists', foodId: existing.foodId };
    }

    const food = await this.prisma.food.create({
      data: {
        normalizedName: dto.normalizedName,
        locale: 'mn',
        sourceType: 'user',
        status: 'pending',
        servings: {
          create: {
            label: dto.servingLabel,
            gramsPerUnit: dto.gramsPerUnit,
            isDefault: true,
          },
        },
        nutrients: {
          create: {
            caloriesPer100g: dto.caloriesPer100g,
            proteinPer100g: dto.proteinPer100g,
            carbsPer100g: dto.carbsPer100g,
            fatPer100g: dto.fatPer100g,
          },
        },
        barcodes: {
          create: { code: dto.code },
        },
      },
    });

    await this.prisma.moderationQueue.create({
      data: {
        entityType: 'barcode_submission',
        entityId: food.id,
        submittedBy: userId,
        status: 'pending',
      },
    });

    return { status: 'submitted', foodId: food.id };
  }
}
