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

  describe('getRollingTrend', () => {
    it('should return empty array when no data', async () => {
      const result = await service.getRollingTrend('user-uuid', 7);
      expect(result).toEqual([]);
    });

    it('window=1 returns each raw entry as its own rollingAvg', async () => {
      prisma.weightLog.findMany.mockResolvedValue([
        { id: 'wl-1', weightKg: 80, loggedAt: new Date('2026-03-01') },
        { id: 'wl-2', weightKg: 79, loggedAt: new Date('2026-03-02') },
      ]);
      const result = await service.getRollingTrend('user-uuid', 1);
      expect(result[0].rollingAvg).toBe(80);
      expect(result[1].rollingAvg).toBe(79);
    });

    it('window=7 smooths over up to 7 preceding entries', async () => {
      // 7 entries at 80 kg each → rolling avg should be 80
      prisma.weightLog.findMany.mockResolvedValue(
        Array.from({ length: 7 }, (_, i) => ({
          id: `wl-${i}`,
          weightKg: 80,
          loggedAt: new Date(2026, 2, i + 1),
        })),
      );
      const result = await service.getRollingTrend('user-uuid', 7);
      expect(result).toHaveLength(7);
      // Every point averages the same value
      result.forEach((p) => expect(p.rollingAvg).toBe(80));
    });

    it('returns date in YYYY-MM-DD format', async () => {
      prisma.weightLog.findMany.mockResolvedValue([
        { id: 'wl-1', weightKg: 78, loggedAt: new Date('2026-04-15') },
      ]);
      const result = await service.getRollingTrend('user-uuid', 7);
      expect(result[0].date).toBe('2026-04-15');
    });

    it('partial window at start uses only available entries', async () => {
      prisma.weightLog.findMany.mockResolvedValue([
        { id: 'wl-1', weightKg: 80, loggedAt: new Date('2026-03-01') },
        { id: 'wl-2', weightKg: 76, loggedAt: new Date('2026-03-02') },
        { id: 'wl-3', weightKg: 78, loggedAt: new Date('2026-03-03') },
      ]);
      const result = await service.getRollingTrend('user-uuid', 7);
      // First point: only 1 entry → avg = 80
      expect(result[0].rollingAvg).toBe(80);
      // Second point: 2 entries → avg = (80+76)/2 = 78
      expect(result[1].rollingAvg).toBe(78);
      // Third point: 3 entries → avg = (80+76+78)/3 = 78
      expect(result[2].rollingAvg).toBe(78);
    });
  });
});
