import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MealTemplatesService } from './meal-templates.service';
import { PrismaService } from '../prisma';

describe('MealTemplatesService', () => {
  let service: MealTemplatesService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: Record<string, any>;

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

  const mockTemplate = {
    id: 'template-uuid',
    userId: 'user-uuid',
    name: 'My Lunch',
    mealType: 'lunch',
    usageCount: 3,
    lastUsedAt: new Date('2026-03-20T12:00:00Z'),
    createdAt: new Date('2026-03-01T12:00:00Z'),
    updatedAt: new Date('2026-03-20T12:00:00Z'),
    items: [
      {
        id: 'titem-uuid',
        foodId: 'food-uuid',
        servingId: 'serving-uuid',
        quantity: 1,
        sortOrder: 0,
        createdAt: new Date(),
        food: { normalizedName: 'Цагаан будаа' },
        serving: { label: '1 cup', gramsPerUnit: 200 },
      },
    ],
  };

  const mockMealLog = {
    id: 'log-uuid',
    userId: 'user-uuid',
    mealType: 'lunch',
    source: 'text',
    loggedAt: new Date('2026-03-25T12:00:00Z'),
    note: 'From template: My Lunch',
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
      mealTemplate: {
        create: jest.fn().mockResolvedValue(mockTemplate),
        findMany: jest.fn().mockResolvedValue([mockTemplate]),
        findFirst: jest.fn().mockResolvedValue(mockTemplate),
        update: jest.fn().mockResolvedValue(mockTemplate),
        count: jest.fn().mockResolvedValue(1),
        delete: jest.fn(),
      },
      mealTemplateItem: {
        deleteMany: jest.fn(),
      },
      mealLog: {
        findFirst: jest.fn().mockResolvedValue({
          ...mockMealLog,
          items: [
            {
              id: 'item-uuid',
              foodId: 'food-uuid',
              quantity: 1,
              servingLabel: '1 cup',
              gramsPerUnit: 200,
              snapshotFoodName: 'Цагаан будаа',
            },
          ],
        }),
        create: jest.fn().mockResolvedValue(mockMealLog),
      },
      food: {
        findMany: jest.fn().mockResolvedValue([mockFood]),
      },
      $transaction: jest.fn().mockImplementation((args) => Promise.all(args)),
    };
    service = new MealTemplatesService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('creates a template with items', async () => {
      const result = await service.create('user-uuid', {
        name: 'My Lunch',
        mealType: 'lunch',
        items: [{ foodId: 'food-uuid', servingId: 'serving-uuid', quantity: 1 }],
      });

      expect(prisma.mealTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'My Lunch', userId: 'user-uuid' }),
        }),
      );
      expect(result.name).toBe('My Lunch');
      expect(result.items).toHaveLength(1);
    });
  });

  describe('createFromLog', () => {
    it('creates a template from an existing meal log', async () => {
      const result = await service.createFromLog('user-uuid', 'log-uuid', {
        name: 'Saved Lunch',
      });

      expect(prisma.mealLog.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'log-uuid', userId: 'user-uuid' } }),
      );
      expect(prisma.mealTemplate.create).toHaveBeenCalled();
      expect(result.name).toBe('My Lunch');
    });

    it('throws NotFoundException for missing meal log', async () => {
      prisma.mealLog.findFirst.mockResolvedValue(null);
      await expect(
        service.createFromLog('user-uuid', 'missing', { name: 'Saved' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for quick-add-only meal logs', async () => {
      prisma.mealLog.findFirst.mockResolvedValue({
        ...mockMealLog,
        items: [{ id: 'item-uuid', foodId: null, quantity: 1 }],
      });
      await expect(
        service.createFromLog('user-uuid', 'log-uuid', { name: 'Saved' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findByUser', () => {
    it('returns paginated templates', async () => {
      const result = await service.findByUser('user-uuid', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findById', () => {
    it('returns a template with nutrition details', async () => {
      prisma.mealTemplate.findFirst.mockResolvedValue({
        ...mockTemplate,
        items: [
          {
            ...mockTemplate.items[0],
            food: { ...mockFood },
            serving: mockFood.servings[0],
          },
        ],
      });

      const result = await service.findById('user-uuid', 'template-uuid');
      expect(result.id).toBe('template-uuid');
      expect(result.items[0].estimatedNutrition).toBeDefined();
      expect(result.items[0].estimatedNutrition?.calories).toBe(260);
    });

    it('throws NotFoundException for missing template', async () => {
      prisma.mealTemplate.findFirst.mockResolvedValue(null);
      await expect(service.findById('user-uuid', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes a template', async () => {
      await service.remove('user-uuid', 'template-uuid');
      expect(prisma.mealTemplate.delete).toHaveBeenCalledWith({
        where: { id: 'template-uuid' },
      });
    });

    it('throws NotFoundException for missing template', async () => {
      prisma.mealTemplate.findFirst.mockResolvedValue(null);
      await expect(service.remove('user-uuid', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('logTemplate', () => {
    it('creates a meal log from template and increments usage', async () => {
      const result = await service.logTemplate('user-uuid', 'template-uuid', {
        items: [{ foodId: 'food-uuid', servingId: 'serving-uuid', quantity: 1 }],
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.totalCalories).toBe(260);
      expect(result.source).toBe('text');
    });

    it('throws NotFoundException for missing template', async () => {
      prisma.mealTemplate.findFirst.mockResolvedValue(null);
      await expect(
        service.logTemplate('user-uuid', 'missing', {
          items: [{ foodId: 'food-uuid', servingId: 'serving-uuid', quantity: 1 }],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
