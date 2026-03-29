import { FoodIndexerService } from './food-indexer.service';
import { PrismaService } from '../prisma';
import { TypesenseProvider } from './typesense.provider';

describe('FoodIndexerService', () => {
  let service: FoodIndexerService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let typesense: Partial<TypesenseProvider>;

  const mockFood = {
    id: 'food-uuid',
    normalizedName: 'Цагаан будаа',
    locale: 'mn',
    status: 'approved',
    sourceType: 'admin',
    nutrients: [{ caloriesPer100g: 130, proteinPer100g: 2.7 }],
    aliases: [{ alias: 'rice' }],
    localizations: [
      { locale: 'en', name: 'White Rice' },
      { locale: 'mn', name: 'Цагаан будаа' },
    ],
    barcodes: [{ code: '123456' }],
  };

  beforeEach(() => {
    prisma = {
      food: {
        findUnique: jest.fn().mockResolvedValue(mockFood),
        findMany: jest.fn().mockResolvedValue([mockFood]),
      },
    };
    typesense = {
      isAvailable: true,
      upsertDocuments: jest.fn().mockResolvedValue(1),
      deleteDocument: jest.fn(),
    };
    service = new FoodIndexerService(
      prisma as unknown as PrismaService,
      typesense as TypesenseProvider,
    );
  });

  describe('indexFood', () => {
    it('should index an approved food', async () => {
      const result = await service.indexFood('food-uuid');
      expect(result).toBe(true);
      expect(typesense.upsertDocuments).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'food-uuid',
          name: 'Цагаан будаа',
          locale: 'mn',
          name_en: 'White Rice',
          name_mn: 'Цагаан будаа',
        }),
      ]);
    });

    it('should delete non-approved food from index', async () => {
      prisma.food.findUnique.mockResolvedValue({ ...mockFood, status: 'pending' });
      const result = await service.indexFood('food-uuid');
      expect(result).toBe(false);
      expect(typesense.deleteDocument).toHaveBeenCalledWith('food-uuid');
    });

    it('should return false when Typesense unavailable', async () => {
      (typesense as { isAvailable: boolean }).isAvailable = false;
      const result = await service.indexFood('food-uuid');
      expect(result).toBe(false);
    });
  });

  describe('reindexAll', () => {
    it('should batch index all approved foods', async () => {
      prisma.food.findMany.mockResolvedValueOnce([mockFood]);

      const count = await service.reindexAll();
      expect(count).toBe(1);
      expect(prisma.food.findMany).toHaveBeenCalledTimes(1);
      expect(typesense.upsertDocuments).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'food-uuid' }),
      ]);
    });

    it('should return 0 when Typesense unavailable', async () => {
      (typesense as { isAvailable: boolean }).isAvailable = false;
      const count = await service.reindexAll();
      expect(count).toBe(0);
    });
  });
});
