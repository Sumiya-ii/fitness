import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FavoritesService } from './favorites.service';
import { PrismaService } from '../prisma';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  beforeEach(() => {
    prisma = {
      favorite: {
        create: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      food: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      mealLogItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    service = new FavoritesService(prisma as unknown as PrismaService);
  });

  describe('addFavorite', () => {
    it('should add a food as favorite', async () => {
      prisma.favorite.create.mockResolvedValue({
        id: 'fav-uuid',
        foodId: 'food-uuid',
        createdAt: new Date('2026-01-01'),
      });

      const result = await service.addFavorite('user-uuid', 'food-uuid');
      expect(result.foodId).toBe('food-uuid');
    });

    it('should throw ConflictException on duplicate', async () => {
      prisma.favorite.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('', {
          code: 'P2002',
          clientVersion: '5.0.0',
        }),
      );

      await expect(service.addFavorite('user-uuid', 'food-uuid')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('removeFavorite', () => {
    it('should remove favorite', async () => {
      await service.removeFavorite('user-uuid', 'food-uuid');
      expect(prisma.favorite.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-uuid', foodId: 'food-uuid' },
      });
    });
  });

  describe('getRecents', () => {
    it('should return deduplicated recent foods', async () => {
      prisma.mealLogItem.findMany.mockResolvedValue([
        {
          foodId: 'food-1',
          snapshotFoodName: 'Rice',
          snapshotCalories: 260,
          snapshotProtein: 5.4,
          createdAt: new Date('2026-03-04'),
        },
        {
          foodId: 'food-1',
          snapshotFoodName: 'Rice',
          snapshotCalories: 130,
          snapshotProtein: 2.7,
          createdAt: new Date('2026-03-03'),
        },
        {
          foodId: 'food-2',
          snapshotFoodName: 'Chicken',
          snapshotCalories: 200,
          snapshotProtein: 25,
          createdAt: new Date('2026-03-02'),
        },
      ]);

      const result = await service.getRecents('user-uuid');
      expect(result).toHaveLength(2);
      expect(result[0].foodId).toBe('food-1');
      expect(result[1].foodId).toBe('food-2');
    });

    it('should return empty for no logs', async () => {
      const result = await service.getRecents('user-uuid');
      expect(result).toHaveLength(0);
    });

    it('groups voice/photo items by canonicalFoodId so duplicates collapse', async () => {
      // Three logs of "Бууз" via voice, in different spellings → one canonical id.
      prisma.mealLogItem.findMany.mockResolvedValue([
        {
          foodId: null,
          canonicalFoodId: 'mn_buuz',
          snapshotFoodName: 'Бууз',
          snapshotCalories: 360,
          snapshotProtein: 28,
          createdAt: new Date('2026-04-25'),
        },
        {
          foodId: null,
          canonicalFoodId: 'mn_buuz',
          snapshotFoodName: 'buuz',
          snapshotCalories: 360,
          snapshotProtein: 28,
          createdAt: new Date('2026-04-24'),
        },
        {
          foodId: null,
          canonicalFoodId: 'mn_khuushuur',
          snapshotFoodName: 'Хуушуур',
          snapshotCalories: 240,
          snapshotProtein: 12,
          createdAt: new Date('2026-04-23'),
        },
      ]);

      const result = await service.getRecents('user-uuid');
      expect(result).toHaveLength(2);
      expect(result[0].canonicalFoodId).toBe('mn_buuz');
      expect(result[0].foodId).toBeNull();
      expect(result[1].canonicalFoodId).toBe('mn_khuushuur');
    });

    it('does not collapse a catalog food and a canonical-only item even if both refer to similar food', async () => {
      // Catalog food "rice (food-1)" should be a separate row from a canonical-only "mn_white_rice_cooked"
      // — different identity spaces. We dedupe within a space, not across.
      prisma.mealLogItem.findMany.mockResolvedValue([
        {
          foodId: 'food-1',
          canonicalFoodId: null,
          snapshotFoodName: 'Catalog rice',
          snapshotCalories: 200,
          snapshotProtein: 4,
          createdAt: new Date('2026-04-25'),
        },
        {
          foodId: null,
          canonicalFoodId: 'mn_white_rice_cooked',
          snapshotFoodName: 'Цагаан будаа',
          snapshotCalories: 200,
          snapshotProtein: 4,
          createdAt: new Date('2026-04-24'),
        },
      ]);

      const result = await service.getRecents('user-uuid');
      expect(result).toHaveLength(2);
    });
  });
});
