import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { Prisma } from '@prisma/client';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async addFavorite(userId: string, foodId: string) {
    try {
      const favorite = await this.prisma.favorite.create({
        data: { userId, foodId },
      });
      return { id: favorite.id, foodId, createdAt: favorite.createdAt.toISOString() };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Food is already a favorite');
      }
      throw e;
    }
  }

  async removeFavorite(userId: string, foodId: string) {
    await this.prisma.favorite.deleteMany({
      where: { userId, foodId },
    });
  }

  async getFavorites(userId: string, limit = 20) {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    if (favorites.length === 0) return [];

    const foodIds = favorites.map((f) => f.foodId);

    const foods = await this.prisma.food.findMany({
      where: { id: { in: foodIds } },
      include: { servings: true, nutrients: true },
    });

    const foodMap = new Map(foods.map((f) => [f.id, f]));

    return favorites
      .map((fav) => {
        const food = foodMap.get(fav.foodId);
        if (!food) return null;
        const nutrient = food.nutrients[0];
        return {
          id: fav.id,
          foodId: food.id,
          name: food.normalizedName,
          caloriesPer100g: nutrient ? Number(nutrient.caloriesPer100g) : 0,
          proteinPer100g: nutrient ? Number(nutrient.proteinPer100g) : 0,
          servingCount: food.servings.length,
          favoritedAt: fav.createdAt.toISOString(),
        };
      })
      .filter(Boolean);
  }

  async getRecents(userId: string, limit = 20) {
    // Include items that have either a catalog foodId OR a canonical id from
    // the normalizer (voice/photo logs). Without canonical_food_id, voice
    // entries previously never appeared in recents at all.
    const recentItems = await this.prisma.mealLogItem.findMany({
      where: {
        userId,
        OR: [{ foodId: { not: null } }, { canonicalFoodId: { not: null } }],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        foodId: true,
        canonicalFoodId: true,
        snapshotFoodName: true,
        snapshotCalories: true,
        snapshotProtein: true,
        createdAt: true,
      },
      take: limit * 4, // fetch extra to deduplicate across both id spaces
    });

    // Dedupe by foodId first (catalog-backed identity wins), falling back to
    // canonicalFoodId. The composite key prevents "Бууз" from collapsing with
    // a separate catalog "Buuz with veggies" food row that happens to share a
    // canonical id.
    const seen = new Set<string>();
    const deduped: typeof recentItems = [];
    for (const item of recentItems) {
      const key = item.foodId
        ? `food:${item.foodId}`
        : item.canonicalFoodId
          ? `canon:${item.canonicalFoodId}`
          : null;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
      if (deduped.length >= limit) break;
    }

    return deduped.map((item) => ({
      foodId: item.foodId,
      canonicalFoodId: item.canonicalFoodId,
      name: item.snapshotFoodName,
      lastCalories: item.snapshotCalories,
      lastProtein: Number(item.snapshotProtein),
      lastUsedAt: item.createdAt.toISOString(),
    }));
  }
}
