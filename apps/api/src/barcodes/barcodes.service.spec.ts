import { NotFoundException } from '@nestjs/common';
import { BarcodesService } from './barcodes.service';
import { PrismaService } from '../prisma';

describe('BarcodesService', () => {
  let service: BarcodesService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  beforeEach(() => {
    prisma = {
      barcode: {
        findUnique: jest.fn(),
      },
      food: {
        create: jest.fn().mockResolvedValue({ id: 'new-food-uuid' }),
      },
      moderationQueue: {
        create: jest.fn(),
      },
    };
    service = new BarcodesService(prisma as unknown as PrismaService);
  });

  describe('lookup', () => {
    it('should return food for known barcode', async () => {
      prisma.barcode.findUnique.mockResolvedValue({
        code: '4901001000012',
        food: {
          id: 'food-uuid',
          normalizedName: 'Test Product',
          locale: 'mn',
          servings: [{ id: 's1', label: '1 piece', gramsPerUnit: 50, isDefault: true }],
          nutrients: [{ caloriesPer100g: 200, proteinPer100g: 10, carbsPer100g: 25, fatPer100g: 8 }],
          localizations: [{ locale: 'en', name: 'Test Product EN' }],
        },
      });

      const result = await service.lookup('4901001000012');
      expect(result.code).toBe('4901001000012');
      expect(result.food.id).toBe('food-uuid');
      expect(result.food.nutrients?.caloriesPer100g).toBe(200);
    });

    it('should throw NotFoundException for unknown barcode', async () => {
      prisma.barcode.findUnique.mockResolvedValue(null);
      await expect(service.lookup('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitUnknown', () => {
    it('should create food and moderation queue entry', async () => {
      prisma.barcode.findUnique.mockResolvedValue(null);

      const result = await service.submitUnknown('user-uuid', {
        code: '999999',
        normalizedName: 'New Product',
        caloriesPer100g: 150,
        proteinPer100g: 5,
        carbsPer100g: 20,
        fatPer100g: 6,
        servingLabel: '1 package',
        gramsPerUnit: 100,
      });

      expect(result.status).toBe('submitted');
      expect(result.foodId).toBe('new-food-uuid');
      expect(prisma.moderationQueue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'barcode_submission',
            status: 'pending',
          }),
        }),
      );
    });

    it('should return already_exists if barcode known', async () => {
      prisma.barcode.findUnique.mockResolvedValue({ code: '999999', foodId: 'existing-food' });

      const result = await service.submitUnknown('user-uuid', {
        code: '999999',
        normalizedName: 'Duplicate',
        caloriesPer100g: 100,
        proteinPer100g: 5,
        carbsPer100g: 10,
        fatPer100g: 3,
        servingLabel: '1 piece',
        gramsPerUnit: 50,
      });

      expect(result.status).toBe('already_exists');
      expect(prisma.food.create).not.toHaveBeenCalled();
    });
  });
});
