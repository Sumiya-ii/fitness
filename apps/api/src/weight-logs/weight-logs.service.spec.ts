import { WeightLogsService } from './weight-logs.service';
import { PrismaService } from '../prisma';

describe('WeightLogsService', () => {
  let service: WeightLogsService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  beforeEach(() => {
    prisma = {
      weightLog: {
        upsert: jest.fn().mockResolvedValue({
          id: 'wl-uuid',
          weightKg: 80,
          loggedAt: new Date('2026-03-04'),
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    service = new WeightLogsService(prisma as unknown as PrismaService);
  });

  describe('log', () => {
    it('should upsert weight for a date', async () => {
      const result = await service.log('user-uuid', { weightKg: 80 });
      expect(result.weightKg).toBe(80);
      expect(prisma.weightLog.upsert).toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    it('should return weight log history', async () => {
      prisma.weightLog.findMany.mockResolvedValue([
        { id: 'wl1', weightKg: 80, loggedAt: new Date('2026-03-01') },
        { id: 'wl2', weightKg: 79.5, loggedAt: new Date('2026-03-04') },
      ]);

      const result = await service.getHistory('user-uuid', 30);
      expect(result).toHaveLength(2);
      expect(result[1].weightKg).toBe(79.5);
    });
  });

  describe('getTrend', () => {
    it('should return null for no data', async () => {
      const result = await service.getTrend('user-uuid');
      expect(result).toBeNull();
    });

    it('should calculate trend from weight logs', async () => {
      const logs = Array.from({ length: 10 }, (_, i) => ({
        id: `wl-${i}`,
        weightKg: 80 - i * 0.1,
        loggedAt: new Date(`2026-03-0${10 - i}`),
      }));
      prisma.weightLog.findMany.mockResolvedValue(logs);

      const result = await service.getTrend('user-uuid');
      expect(result).not.toBeNull();
      expect(result!.current).toBe(80);
      expect(result!.weeklyDelta).toBeDefined();
      expect(result!.dataPoints).toBe(10);
    });
  });
});
