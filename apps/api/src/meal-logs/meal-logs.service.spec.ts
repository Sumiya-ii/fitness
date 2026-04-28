import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MealLogsService } from './meal-logs.service';
import { PrismaService } from '../prisma';

describe('MealLogsService', () => {
  let service: MealLogsService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  const mockFood = {
    id: 'food-uuid',
    normalizedName: 'Цагаан будаа',
    servings: [{ id: 'serving-uuid', label: '1 cup', gramsPerUnit: 200, isDefault: true }],
    nutrients: [
      {
        caloriesPer100g: 130,
        proteinPer100g: 2.7,
        carbsPer100g: 28,
        fatPer100g: 0.3,
        fiberPer100g: 0.4,
        sugarPer100g: null,
        sodiumPer100g: null,
        saturatedFatPer100g: null,
      },
    ],
  };

  const mockMealLog = {
    id: 'log-uuid',
    userId: 'user-uuid',
    mealType: 'lunch',
    source: 'text',
    loggedAt: new Date('2026-03-04T12:00:00Z'),
    note: null,
    totalCalories: 260,
    totalProtein: 5.4,
    totalCarbs: 56,
    totalFat: 0.6,
    totalFiber: 0.8,
    totalSugar: null,
    totalSodium: null,
    totalSaturatedFat: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      {
        id: 'item-uuid',
        foodId: 'food-uuid',
        quantity: 1,
        servingLabel: '1 cup',
        gramsPerUnit: 200,
        snapshotFoodName: 'Цагаан будаа',
        snapshotCalories: 260,
        snapshotProtein: 5.4,
        snapshotCarbs: 56,
        snapshotFat: 0.6,
        snapshotFiber: 0.8,
        snapshotSugar: null,
        snapshotSodium: null,
        snapshotSaturatedFat: null,
        createdAt: new Date(),
      },
    ],
  };

  beforeEach(() => {
    prisma = {
      food: {
        findMany: jest.fn().mockResolvedValue([mockFood]),
      },
      mealLog: {
        create: jest.fn().mockResolvedValue(mockMealLog),
        findMany: jest.fn().mockResolvedValue([mockMealLog]),
        findFirst: jest.fn().mockResolvedValue(mockMealLog),
        update: jest.fn().mockResolvedValue({ ...mockMealLog, mealType: 'dinner' }),
        count: jest.fn().mockResolvedValue(1),
        delete: jest.fn(),
      },
    };
    service = new MealLogsService(prisma as unknown as PrismaService);
  });

  describe('createFromFood', () => {
    it('should create meal log with immutable nutrition snapshots including fiber', async () => {
      const result = await service.createFromFood('user-uuid', {
        mealType: 'lunch',
        source: 'text',
        items: [{ foodId: 'food-uuid', servingId: 'serving-uuid', quantity: 1 }],
      });

      expect(result.id).toBe('log-uuid');
      expect(result.totalCalories).toBe(260);
      expect(result.totalFiber).toBe(0.8);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].snapshotFiber).toBe(0.8);

      const createCall = prisma.mealLog.create.mock.calls[0][0];
      const itemData = createCall.data.items.create[0];
      expect(itemData.snapshotCalories).toBe(260);
      expect(itemData.snapshotFoodName).toBe('Цагаан будаа');
      expect(itemData.snapshotFiber).toBeCloseTo(0.8, 1);
    });

    it('should batch food lookups in a single query', async () => {
      await service.createFromFood('user-uuid', {
        source: 'text',
        items: [{ foodId: 'food-uuid', servingId: 'serving-uuid', quantity: 1 }],
      });

      // Should call findMany once (batched), not findUnique per item
      expect(prisma.food.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.food.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['food-uuid'] } },
        }),
      );
    });

    it('should throw when food not found', async () => {
      prisma.food.findMany.mockResolvedValue([]);
      await expect(
        service.createFromFood('user-uuid', {
          source: 'text',
          items: [{ foodId: 'missing', servingId: 'serving-uuid', quantity: 1 }],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when serving not found', async () => {
      await expect(
        service.createFromFood('user-uuid', {
          source: 'text',
          items: [{ foodId: 'food-uuid', servingId: 'wrong-serving', quantity: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('quickAdd', () => {
    it('should create quick add meal log with optional fiber', async () => {
      const quickAddLog = {
        ...mockMealLog,
        source: 'quick_add',
        totalCalories: 500,
        totalProtein: 30,
        totalCarbs: 50,
        totalFat: 15,
        totalFiber: 5,
        items: [
          {
            id: 'item-uuid',
            foodId: null,
            quantity: 1,
            servingLabel: 'Quick Add',
            gramsPerUnit: 0,
            snapshotFoodName: 'Quick Add',
            snapshotCalories: 500,
            snapshotProtein: 30,
            snapshotCarbs: 50,
            snapshotFat: 15,
            snapshotFiber: 5,
            snapshotSugar: null,
            snapshotSodium: null,
            snapshotSaturatedFat: null,
            createdAt: new Date(),
          },
        ],
      };
      prisma.mealLog.create.mockResolvedValue(quickAddLog);

      const result = await service.quickAdd('user-uuid', {
        calories: 500,
        proteinGrams: 30,
        carbsGrams: 50,
        fatGrams: 15,
        fiberGrams: 5,
        source: 'quick_add',
      });

      expect(result.totalCalories).toBe(500);
      expect(result.totalFiber).toBe(5);
      expect(result.source).toBe('quick_add');
    });
  });

  describe('update', () => {
    it('should update mealType and note', async () => {
      const result = await service.update('user-uuid', 'log-uuid', { mealType: 'dinner' });
      expect(prisma.mealLog.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'log-uuid' }, data: { mealType: 'dinner' } }),
      );
      expect(result.mealType).toBe('dinner');
    });

    it('should throw if log not found', async () => {
      prisma.mealLog.findFirst.mockResolvedValue(null);
      await expect(service.update('user-uuid', 'missing', { mealType: 'dinner' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByUser', () => {
    it('should return paginated meal logs', async () => {
      const result = await service.findByUser('user-uuid', { page: 1, limit: 50 });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by date using UTC boundaries', async () => {
      await service.findByUser('user-uuid', {
        page: 1,
        limit: 50,
        date: '2026-03-04',
      });
      const whereArg = prisma.mealLog.findMany.mock.calls[0][0].where;
      expect(whereArg.loggedAt).toBeDefined();
      // Boundaries must be UTC midnight, not server-local midnight
      expect(whereArg.loggedAt.gte.toISOString()).toBe('2026-03-04T00:00:00.000Z');
      expect(whereArg.loggedAt.lt.toISOString()).toBe('2026-03-05T00:00:00.000Z');
    });
  });

  describe('remove', () => {
    it('should delete meal log owned by user', async () => {
      await service.remove('user-uuid', 'log-uuid');
      expect(prisma.mealLog.delete).toHaveBeenCalledWith({ where: { id: 'log-uuid' } });
    });

    it('should throw if log not found', async () => {
      prisma.mealLog.findFirst.mockResolvedValue(null);
      await expect(service.remove('user-uuid', 'missing')).rejects.toThrow(NotFoundException);
    });
  });
});
