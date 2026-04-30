import { NotFoundException } from '@nestjs/common';
import { FoodsService } from './foods.service';
import { PrismaService } from '../prisma';

describe('FoodsService', () => {
  let service: FoodsService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  const mockFoodRaw = {
    id: 'food-uuid',
    normalizedName: 'Цагаан будаа',
    locale: 'mn',
    status: 'approved',
    sourceType: 'admin',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    servings: [
      {
        id: 'serving-uuid',
        label: '1 cup',
        labelMn: '1 аяга',
        gramsPerUnit: { toString: () => '200' },
        isDefault: true,
      },
    ],
    nutrients: [
      {
        id: 'nutrient-uuid',
        caloriesPer100g: { toString: () => '130' },
        proteinPer100g: { toString: () => '2.7' },
        carbsPer100g: { toString: () => '28' },
        fatPer100g: { toString: () => '0.3' },
        fiberPer100g: { toString: () => '0.4' },
        sugarPer100g: null,
        sodiumPer100g: null,
        saturatedFatPer100g: null,
      },
    ],
    aliases: [{ id: 'alias-uuid', alias: 'rice', locale: 'en' }],
    localizations: [{ id: 'loc-uuid', locale: 'en', name: 'White Rice' }],
  };

  beforeEach(() => {
    prisma = {
      food: {
        create: jest.fn().mockResolvedValue(mockFoodRaw),
        findUnique: jest.fn().mockResolvedValue(mockFoodRaw),
        findMany: jest.fn().mockResolvedValue([mockFoodRaw]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue(mockFoodRaw),
        delete: jest.fn().mockResolvedValue(mockFoodRaw),
      },
      foodNutrient: { updateMany: jest.fn() },
      foodServing: { deleteMany: jest.fn(), createMany: jest.fn() },
      foodLocalization: { deleteMany: jest.fn(), createMany: jest.fn() },
      foodAlias: { deleteMany: jest.fn(), createMany: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'food-uuid' }]),
    };
    service = new FoodsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('should create food with servings and nutrients', async () => {
      const result = await service.create({
        normalizedName: 'Цагаан будаа',
        locale: 'mn',
        sourceType: 'admin',
        servings: [{ label: '1 cup', gramsPerUnit: 200, isDefault: true }],
        nutrients: {
          caloriesPer100g: 130,
          proteinPer100g: 2.7,
          carbsPer100g: 28,
          fatPer100g: 0.3,
        },
      });

      expect(result.id).toBe('food-uuid');
      expect(result.normalizedName).toBe('Цагаан будаа');
      expect(result.servings).toHaveLength(1);
      expect(result.nutrients?.caloriesPer100g).toBe(130);
      expect(prisma.food.create).toHaveBeenCalled();
    });

    it('should create with aliases and localizations', async () => {
      await service.create({
        normalizedName: 'Test Food',
        locale: 'mn',
        sourceType: 'admin',
        servings: [{ label: '100g', gramsPerUnit: 100 }],
        nutrients: {
          caloriesPer100g: 100,
          proteinPer100g: 5,
          carbsPer100g: 20,
          fatPer100g: 1,
        },
        aliases: [{ alias: 'test', locale: 'en' }],
        localizations: [{ locale: 'en', name: 'Test Food EN' }],
      });

      const createCall = prisma.food.create.mock.calls[0][0];
      expect(createCall.data.aliases).toBeDefined();
      expect(createCall.data.localizations).toBeDefined();
    });
  });

  describe('findById', () => {
    it('should return formatted food', async () => {
      const result = await service.findById('food-uuid');
      expect(result.id).toBe('food-uuid');
      expect(result.localizations[0].name).toBe('White Rice');
    });

    it('should throw NotFoundException for missing food', async () => {
      prisma.food.findUnique.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findMany', () => {
    it('should return paginated results', async () => {
      const result = await service.findMany({ page: 1, limit: 20 });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('should filter by locale', async () => {
      await service.findMany({ page: 1, limit: 20, locale: 'mn' });
      const whereArg = prisma.food.findMany.mock.calls[0][0].where;
      expect(whereArg.locale).toBe('mn');
    });

    it('should search by name (no userId — uses findMany path)', async () => {
      await service.findMany({ page: 1, limit: 20, search: 'будаа' });
      const whereArg = prisma.food.findMany.mock.calls[0][0].where;
      expect(whereArg.OR).toBeDefined();
    });

    it('should use $queryRaw ranked path when search + userId provided', async () => {
      const result = await service.findMany({ page: 1, limit: 20, search: 'будаа' }, 'user-uuid');
      expect(prisma.$queryRaw).toHaveBeenCalled();
      // findMany is called to hydrate the ranked IDs
      expect(prisma.food.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['food-uuid'] } } }),
      );
      expect(result.data).toHaveLength(1);
    });

    it('returns empty result when $queryRaw returns no rows', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      const result = await service.findMany({ page: 1, limit: 20, search: 'xyz' }, 'user-uuid');
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      // Should not bother calling findMany when no IDs to hydrate
      expect(prisma.food.findMany).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete existing food', async () => {
      await service.remove('food-uuid');
      expect(prisma.food.delete).toHaveBeenCalledWith({ where: { id: 'food-uuid' } });
    });

    it('should throw if food not found', async () => {
      prisma.food.findUnique.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
