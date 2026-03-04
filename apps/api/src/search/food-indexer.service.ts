import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { TypesenseProvider, FoodSearchDocument } from './typesense.provider';

@Injectable()
export class FoodIndexerService {
  private readonly logger = new Logger(FoodIndexerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly typesense: TypesenseProvider,
  ) {}

  async indexFood(foodId: string): Promise<boolean> {
    if (!this.typesense.isAvailable) return false;

    const food = await this.prisma.food.findUnique({
      where: { id: foodId },
      include: {
        nutrients: true,
        aliases: true,
        localizations: true,
        barcodes: true,
      },
    });

    if (!food || food.status !== 'approved') {
      await this.typesense.deleteDocument(foodId);
      return false;
    }

    const doc = this.toSearchDocument(food);
    const count = await this.typesense.upsertDocuments([doc]);
    return count === 1;
  }

  async reindexAll(): Promise<number> {
    if (!this.typesense.isAvailable) {
      this.logger.warn('Typesense not available, skipping reindex');
      return 0;
    }

    const batchSize = 100;
    let indexed = 0;
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const foods = await this.prisma.food.findMany({
        where: { status: 'approved' },
        include: {
          nutrients: true,
          aliases: true,
          localizations: true,
          barcodes: true,
        },
        take: batchSize,
        skip,
        orderBy: { createdAt: 'asc' },
      });

      if (foods.length === 0) {
        hasMore = false;
        break;
      }

      const docs = foods.map((f) => this.toSearchDocument(f));
      const count = await this.typesense.upsertDocuments(docs);
      indexed += count;
      skip += batchSize;
      hasMore = foods.length === batchSize;

      this.logger.log(`Indexed ${indexed} foods so far...`);
    }

    this.logger.log(`Reindex complete: ${indexed} foods indexed`);
    return indexed;
  }

  private toSearchDocument(food: {
    id: string;
    normalizedName: string;
    locale: string;
    sourceType: string;
    nutrients: Array<{
      caloriesPer100g: unknown;
      proteinPer100g: unknown;
    }>;
    aliases: Array<{ alias: string }>;
    localizations: Array<{ locale: string; name: string }>;
    barcodes: Array<{ code: string }>;
  }): FoodSearchDocument {
    const nutrient = food.nutrients[0];
    const mnLocalization = food.localizations.find((l) => l.locale === 'mn');
    const enLocalization = food.localizations.find((l) => l.locale === 'en');

    return {
      id: food.id,
      name: food.normalizedName,
      name_mn: mnLocalization?.name,
      name_en: enLocalization?.name,
      aliases: food.aliases.map((a) => a.alias),
      locale: food.locale,
      calories_per_100g: Number(nutrient?.caloriesPer100g ?? 0),
      protein_per_100g: Number(nutrient?.proteinPer100g ?? 0),
      barcodes: food.barcodes.map((b) => b.code),
      source_type: food.sourceType,
    };
  }
}
