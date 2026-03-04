/**
 * C-035: Performance Test Pack - Pagination
 * Verifies pagination works correctly and does not return more than limit items.
 */
import { FoodsService } from '../../src/foods/foods.service';
import { MealLogsService } from '../../src/meal-logs/meal-logs.service';
import { foodQuerySchema } from '../../src/foods/foods.dto';
import { mealLogQuerySchema } from '../../src/meal-logs/meal-logs.dto';

describe('Performance: Pagination (NFR-001..003)', () => {
  describe('Food query DTO', () => {
    it('should enforce limit max 100', () => {
      const result = foodQuerySchema.parse({ limit: 100 });
      expect(result.limit).toBe(100);
    });

    it('should default page and limit when not provided', () => {
      const result = foodQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should coerce string limit to number', () => {
      const result = foodQuerySchema.parse({ limit: '10', page: '2' });
      expect(result.limit).toBe(10);
      expect(result.page).toBe(2);
    });

    it('should reject limit over 100', () => {
      expect(() => foodQuerySchema.parse({ limit: 101 })).toThrow();
    });
  });

  describe('Meal log query DTO', () => {
    it('should enforce limit max 100', () => {
      const result = mealLogQuerySchema.parse({ limit: 100 });
      expect(result.limit).toBe(100);
    });

    it('should default page and limit when not provided', () => {
      const result = mealLogQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
    });

    it('should reject limit over 100', () => {
      expect(() => mealLogQuerySchema.parse({ limit: 101 })).toThrow();
    });
  });

  describe('FoodsService findMany pagination', () => {
    it('should not return more than limit items', async () => {
      const limit = 5;
      const mockFoods = Array.from({ length: limit }, (_, i) => ({
        id: `food-${i}`,
        normalizedName: `Food ${i}`,
        locale: 'mn',
        status: 'approved',
        sourceType: 'seed',
        sourceRef: null,
        confidence: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        servings: [{ id: `s-${i}`, label: '100g', labelMn: null, gramsPerUnit: 100, isDefault: true }],
        nutrients: [{ id: `n-${i}`, caloriesPer100g: 100, proteinPer100g: 10, carbsPer100g: 10, fatPer100g: 5, fiberPer100g: null }],
        aliases: [],
        localizations: [],
        barcodes: [],
      }));

      const mockPrisma = {
        food: {
          findMany: jest.fn().mockResolvedValue(mockFoods),
          count: jest.fn().mockResolvedValue(100),
        },
      };

      const service = new FoodsService(mockPrisma as any);
      const result = await service.findMany({ page: 1, limit });

      expect(result.data.length).toBeLessThanOrEqual(limit);
      expect(result.data.length).toBe(limit);
      expect(result.meta.limit).toBe(limit);
      expect(mockPrisma.food.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: limit,
          skip: 0,
        }),
      );
    });
  });

  describe('MealLogsService findByUser pagination', () => {
    it('should not return more than limit items', async () => {
      const limit = 3;
      const mockLogs = Array.from({ length: limit }, (_, i) => ({
        id: `log-${i}`,
        userId: 'user-uuid',
        mealType: 'lunch',
        source: 'text',
        totalCalories: 100,
        totalProtein: 10,
        totalCarbs: 10,
        totalFat: 5,
        loggedAt: new Date(),
        note: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [{
          id: `item-${i}`,
          foodId: null,
          quantity: 1,
          servingLabel: '100g',
          gramsPerUnit: 100,
          snapshotCalories: 100,
          snapshotProtein: 10,
          snapshotCarbs: 10,
          snapshotFat: 5,
          snapshotFoodName: 'Food',
          createdAt: new Date(),
        }],
      }));

      const mockPrisma = {
        mealLog: {
          findMany: jest.fn().mockResolvedValue(mockLogs),
          count: jest.fn().mockResolvedValue(50),
        },
      };

      const service = new MealLogsService(mockPrisma as any);
      const result = await service.findByUser('user-uuid', { page: 1, limit });

      expect(result.data.length).toBeLessThanOrEqual(limit);
      expect(result.data.length).toBe(limit);
      expect(result.meta.limit).toBe(limit);
      expect(mockPrisma.mealLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: limit,
          skip: 0,
        }),
      );
    });
  });
});
