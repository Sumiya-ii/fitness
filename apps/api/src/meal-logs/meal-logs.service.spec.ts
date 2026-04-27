import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MealLogsService } from './meal-logs.service';
import { CalibrationService } from './calibration.service';
import { PrismaService } from '../prisma';

describe('MealLogsService', () => {
  let service: MealLogsService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let calibration: { recordCorrections: jest.Mock; recordCorrection: jest.Mock };

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
      voiceDraft: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'draft-uuid', status: 'completed', parsedItems: null }),
      },
    };
    calibration = {
      recordCorrection: jest.fn().mockResolvedValue(undefined),
      recordCorrections: jest.fn().mockResolvedValue(undefined),
    };
    service = new MealLogsService(
      prisma as unknown as PrismaService,
      calibration as unknown as CalibrationService,
    );
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

  describe('createFromVoice', () => {
    const draftId = '11111111-1111-1111-1111-111111111111';
    const baseItem = {
      name: 'Бууз',
      quantity: 4,
      unit: 'piece',
      grams: 200,
      calories: 360,
      protein: 28,
      carbs: 24,
      fat: 16,
    };

    function mockVoiceLogReturn(
      items: Array<Record<string, unknown>>,
      totals: Record<string, unknown>,
    ) {
      prisma.mealLog.create.mockResolvedValue({
        ...mockMealLog,
        source: 'voice',
        ...totals,
        items: items.map((it, i) => ({
          id: `item-${i}`,
          foodId: null,
          quantity: 4,
          servingLabel: 'piece',
          gramsPerUnit: 50,
          createdAt: new Date(),
          snapshotFiber: null,
          snapshotSugar: null,
          snapshotSodium: null,
          snapshotSaturatedFat: null,
          ...it,
        })),
      });
    }

    it('persists one MealLogItem per parsed item with snapshot nutrition', async () => {
      mockVoiceLogReturn(
        [
          {
            snapshotFoodName: 'Бууз',
            snapshotCalories: 360,
            snapshotProtein: 28,
            snapshotCarbs: 24,
            snapshotFat: 16,
          },
          {
            snapshotFoodName: 'Цай',
            snapshotCalories: 35,
            snapshotProtein: 2,
            snapshotCarbs: 2,
            snapshotFat: 2,
          },
        ],
        { totalCalories: 395, totalProtein: 30, totalCarbs: 26, totalFat: 18 },
      );

      const result = await service.createFromVoice('user-uuid', {
        draftId,
        mealType: 'lunch',
        items: [
          baseItem,
          {
            name: 'Цай',
            quantity: 1,
            unit: 'cup',
            grams: 200,
            calories: 35,
            protein: 2,
            carbs: 2,
            fat: 2,
          },
        ],
      });

      expect(prisma.voiceDraft.findFirst).toHaveBeenCalledWith({
        where: { id: draftId, userId: 'user-uuid' },
        select: { id: true, status: true, parsedItems: true },
      });
      const createCall = prisma.mealLog.create.mock.calls[0][0];
      expect(createCall.data.source).toBe('voice');
      expect(createCall.data.mealType).toBe('lunch');
      expect(createCall.data.items.create).toHaveLength(2);
      expect(createCall.data.items.create[0]).toMatchObject({
        userId: 'user-uuid',
        snapshotFoodName: 'Бууз',
        snapshotCalories: 360,
        servingLabel: 'piece',
        quantity: 4,
        gramsPerUnit: 50,
      });
      expect(result.items).toHaveLength(2);
    });

    it('aggregates optional micronutrients only when provided', async () => {
      mockVoiceLogReturn(
        [
          {
            snapshotFoodName: 'Sandwich',
            snapshotCalories: 400,
            snapshotProtein: 20,
            snapshotCarbs: 40,
            snapshotFat: 15,
            snapshotSugar: 8,
            snapshotSodium: 600,
          },
        ],
        {
          totalCalories: 400,
          totalProtein: 20,
          totalCarbs: 40,
          totalFat: 15,
          totalSugar: 8,
          totalSodium: 600,
          totalFiber: null,
          totalSaturatedFat: null,
        },
      );

      await service.createFromVoice('user-uuid', {
        draftId,
        items: [
          {
            name: 'Sandwich',
            quantity: 1,
            unit: 'piece',
            grams: 250,
            calories: 400,
            protein: 20,
            carbs: 40,
            fat: 15,
            sugar: 8,
            sodium: 600,
          },
        ],
      });

      const createCall = prisma.mealLog.create.mock.calls[0][0];
      expect(createCall.data.totalSugar).toBe(8);
      expect(createCall.data.totalSodium).toBe(600);
      expect(createCall.data.totalFiber).toBeNull();
      expect(createCall.data.totalSaturatedFat).toBeNull();
      expect(createCall.data.items.create[0].snapshotSugar).toBe(8);
      expect(createCall.data.items.create[0].snapshotFiber).toBeNull();
    });

    it('throws NotFoundException when draft does not belong to user', async () => {
      prisma.voiceDraft.findFirst.mockResolvedValue(null);
      await expect(
        service.createFromVoice('user-uuid', { draftId, items: [baseItem] }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.mealLog.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when draft is not completed', async () => {
      prisma.voiceDraft.findFirst.mockResolvedValue({ id: draftId, status: 'active' });
      await expect(
        service.createFromVoice('user-uuid', { draftId, items: [baseItem] }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.mealLog.create).not.toHaveBeenCalled();
    });

    it('sets canonicalFoodId via canonicalize() on each item', async () => {
      mockVoiceLogReturn(
        [
          {
            snapshotFoodName: 'Бууз',
            canonicalFoodId: 'mn_buuz',
            snapshotCalories: 360,
            snapshotProtein: 28,
            snapshotCarbs: 24,
            snapshotFat: 16,
          },
          {
            snapshotFoodName: 'unknown food xyzzy',
            canonicalFoodId: null,
            snapshotCalories: 100,
            snapshotProtein: 5,
            snapshotCarbs: 10,
            snapshotFat: 5,
          },
        ],
        { totalCalories: 460, totalProtein: 33, totalCarbs: 34, totalFat: 21 },
      );

      await service.createFromVoice('user-uuid', {
        draftId,
        items: [
          baseItem,
          {
            name: 'unknown food xyzzy',
            quantity: 1,
            unit: 'serving',
            grams: 100,
            calories: 100,
            protein: 5,
            carbs: 10,
            fat: 5,
          },
        ],
      });

      const createCall = prisma.mealLog.create.mock.calls[0][0];
      const items = createCall.data.items.create;
      expect(items[0].canonicalFoodId).toBe('mn_buuz');
      expect(items[1].canonicalFoodId).toBeNull();
    });

    it('feeds calibration with original-vs-saved kcal per canonical item', async () => {
      const draftId = '11111111-1111-1111-1111-111111111111';
      // Draft envelope shape produced by the worker.
      prisma.voiceDraft.findFirst.mockResolvedValue({
        id: draftId,
        status: 'completed',
        parsedItems: {
          items: [
            { name: 'Бууз', calories: 360 },
            { name: 'unknown food xyzzy', calories: 100 },
          ],
        },
      });
      mockVoiceLogReturn(
        [
          {
            snapshotFoodName: 'Бууз',
            snapshotCalories: 280,
            snapshotProtein: 22,
            snapshotCarbs: 24,
            snapshotFat: 11,
          },
          {
            snapshotFoodName: 'unknown food xyzzy',
            snapshotCalories: 100,
            snapshotProtein: 5,
            snapshotCarbs: 10,
            snapshotFat: 5,
          },
        ],
        { totalCalories: 380, totalProtein: 27, totalCarbs: 34, totalFat: 16 },
      );

      await service.createFromVoice('user-uuid', {
        draftId,
        items: [
          {
            name: 'Бууз',
            quantity: 4,
            unit: 'piece',
            grams: 200,
            calories: 280,
            protein: 22,
            carbs: 24,
            fat: 11,
          },
          {
            name: 'unknown food xyzzy',
            quantity: 1,
            unit: 'serving',
            grams: 100,
            calories: 100,
            protein: 5,
            carbs: 10,
            fat: 5,
          },
        ],
      });

      // `void` fire-and-forget; await microtasks so the spy sees the call.
      await new Promise((r) => setImmediate(r));

      expect(calibration.recordCorrections).toHaveBeenCalledTimes(1);
      const args = calibration.recordCorrections.mock.calls[0];
      expect(args[0]).toBe('user-uuid');
      expect(args[1]).toEqual([
        { canonicalFoodId: 'mn_buuz', originalKcal: 360, correctedKcal: 280 },
        { canonicalFoodId: null, originalKcal: 100, correctedKcal: 100 },
      ]);
    });

    it('skips calibration when draft.parsedItems length differs from saved items', async () => {
      const draftId = '22222222-2222-2222-2222-222222222222';
      prisma.voiceDraft.findFirst.mockResolvedValue({
        id: draftId,
        status: 'completed',
        parsedItems: { items: [{ name: 'Бууз', calories: 360 }] },
      });
      mockVoiceLogReturn(
        [
          {
            snapshotFoodName: 'Бууз',
            snapshotCalories: 280,
            snapshotProtein: 22,
            snapshotCarbs: 24,
            snapshotFat: 11,
          },
          {
            snapshotFoodName: 'Хуушуур',
            snapshotCalories: 240,
            snapshotProtein: 12,
            snapshotCarbs: 30,
            snapshotFat: 9,
          },
        ],
        { totalCalories: 520, totalProtein: 34, totalCarbs: 54, totalFat: 20 },
      );

      await service.createFromVoice('user-uuid', {
        draftId,
        items: [
          {
            name: 'Бууз',
            quantity: 4,
            unit: 'piece',
            grams: 200,
            calories: 280,
            protein: 22,
            carbs: 24,
            fat: 11,
          },
          {
            name: 'Хуушуур',
            quantity: 1,
            unit: 'piece',
            grams: 120,
            calories: 240,
            protein: 12,
            carbs: 30,
            fat: 9,
          },
        ],
      });

      await new Promise((r) => setImmediate(r));
      expect(calibration.recordCorrections).not.toHaveBeenCalled();
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
