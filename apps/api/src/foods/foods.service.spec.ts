import { NotFoundException, HttpException } from '@nestjs/common';
import { FoodsService } from './foods.service';
import { PrismaService } from '../prisma';
import { ConfigService } from '../config';

// Mock ioredis so the constructor doesn't open a real connection
const mockRedis = {
  get: jest.fn(),
  incr: jest.fn(),
  decr: jest.fn(),
  expire: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn(),
};
jest.mock('ioredis', () => jest.fn().mockImplementation(() => mockRedis));

describe('FoodsService', () => {
  let service: FoodsService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  let config: Partial<ConfigService>;

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
    jest.clearAllMocks();
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
      moderationQueue: {
        create: jest.fn().mockResolvedValue({ id: 'queue-uuid' }),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'food-uuid' }]),
      // Interactive transaction: execute the callback with a tx proxy that
      // mirrors the same mock methods so assertions inside the callback work.
      $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          food: prisma.food,
          foodNutrient: prisma.foodNutrient,
          foodServing: prisma.foodServing,
          foodLocalization: prisma.foodLocalization,
          foodAlias: prisma.foodAlias,
        };
        return cb(tx);
      }),
    };
    config = { get: jest.fn().mockReturnValue('redis://localhost:6379') };

    // Default: first suggestion of the day (incr returns 1, under cap)
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.decr.mockResolvedValue(0);
    mockRedis.expire.mockResolvedValue(1);

    service = new FoodsService(prisma as unknown as PrismaService, config as ConfigService);
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

  describe('suggest', () => {
    it('should insert into moderation_queue and return suggestionId', async () => {
      const result = await service.suggest('user-uuid', { name: 'Бууз', locale: 'mn' });
      expect(result.suggestionId).toBe('queue-uuid');
      expect(prisma.moderationQueue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'food_suggestion',
            submittedBy: 'user-uuid',
            status: 'pending',
          }),
        }),
      );
    });

    it('should not include userId in reviewNote', async () => {
      await service.suggest('user-uuid', { name: 'Бууз', locale: 'mn' });
      const createCall = prisma.moderationQueue.create.mock.calls[0][0];
      const note = JSON.parse(createCall.data.reviewNote as string);
      expect(note).not.toHaveProperty('userId');
      expect(note).toHaveProperty('name', 'Бууз');
      expect(note).toHaveProperty('locale', 'mn');
    });

    it('should set Redis TTL on first suggestion of the day (incr returns 1)', async () => {
      mockRedis.incr.mockResolvedValue(1);
      await service.suggest('user-uuid', { name: 'Бууз', locale: 'mn' });
      expect(mockRedis.expire).toHaveBeenCalled();
    });

    it('should not set Redis TTL on subsequent suggestions (incr returns >1)', async () => {
      mockRedis.incr.mockResolvedValue(3);
      await service.suggest('user-uuid', { name: 'Хуушуур', locale: 'mn' });
      expect(mockRedis.expire).not.toHaveBeenCalled();
    });

    it('should throw TooManyRequestsException and decrement counter when cap is exceeded', async () => {
      mockRedis.incr.mockResolvedValue(6); // exceeds cap of 5
      await expect(service.suggest('user-uuid', { name: 'Тавгтай', locale: 'mn' })).rejects.toThrow(
        HttpException,
      );
      // Must roll back the optimistic increment
      expect(mockRedis.decr).toHaveBeenCalled();
      expect(prisma.moderationQueue.create).not.toHaveBeenCalled();
    });

    it('should allow exactly SUGGEST_DAILY_CAP suggestions (incr === cap)', async () => {
      mockRedis.incr.mockResolvedValue(5); // exactly at cap — should succeed
      const result = await service.suggest('user-uuid', { name: 'Бууз', locale: 'mn' });
      expect(result.suggestionId).toBe('queue-uuid');
      expect(mockRedis.decr).not.toHaveBeenCalled();
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

  describe('update', () => {
    const updateDto = {
      normalizedName: 'Шинэ нэр',
      servings: [{ label: '1 cup', gramsPerUnit: 200, isDefault: true }],
      nutrients: {
        caloriesPer100g: 150,
        proteinPer100g: 3,
        carbsPer100g: 30,
        fatPer100g: 1,
      },
    };

    it('should execute all mutations inside a single transaction', async () => {
      await service.update('food-uuid', updateDto);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should update food, servings, and nutrients via transaction', async () => {
      await service.update('food-uuid', updateDto);
      expect(prisma.food.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'food-uuid' } }),
      );
      expect(prisma.foodServing.deleteMany).toHaveBeenCalledWith({
        where: { foodId: 'food-uuid' },
      });
      expect(prisma.foodServing.createMany).toHaveBeenCalled();
      expect(prisma.foodNutrient.updateMany).toHaveBeenCalled();
    });

    it('should throw NotFoundException if food does not exist', async () => {
      prisma.food.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', updateDto)).rejects.toThrow(NotFoundException);
      // Transaction must not be entered for a missing food
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should skip serving/localization/alias mutations when fields are absent in dto', async () => {
      await service.update('food-uuid', { normalizedName: 'Only name change' });
      expect(prisma.foodServing.deleteMany).not.toHaveBeenCalled();
      expect(prisma.foodLocalization.deleteMany).not.toHaveBeenCalled();
      expect(prisma.foodAlias.deleteMany).not.toHaveBeenCalled();
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
