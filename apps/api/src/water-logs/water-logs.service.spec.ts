import { WaterLogsService, DEFAULT_WATER_TARGET_ML } from './water-logs.service';
import { PrismaService } from '../prisma';

describe('WaterLogsService', () => {
  let service: WaterLogsService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  const mockEntry = {
    id: 'wl-uuid',
    amountMl: 250,
    loggedAt: new Date('2026-03-21T08:00:00Z'),
    createdAt: new Date('2026-03-21T08:00:00Z'),
  };

  beforeEach(() => {
    prisma = {
      waterLog: {
        create: jest.fn().mockResolvedValue(mockEntry),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        delete: jest.fn().mockResolvedValue(mockEntry),
      },
      profile: {
        findUnique: jest.fn().mockResolvedValue({ waterTargetMl: 2000 }),
      },
    };
    service = new WaterLogsService(prisma as unknown as PrismaService);
  });

  describe('add', () => {
    it('should create a water log entry and return it', async () => {
      const result = await service.add('user-uuid', { amountMl: 250 });
      expect(result.amountMl).toBe(250);
      expect(result.id).toBe('wl-uuid');
      expect(prisma.waterLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user-uuid', amountMl: 250 }),
        }),
      );
    });

    it('should use provided loggedAt datetime', async () => {
      const loggedAt = '2026-03-21T10:00:00Z';
      await service.add('user-uuid', { amountMl: 500, loggedAt });
      expect(prisma.waterLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amountMl: 500 }),
        }),
      );
    });
  });

  describe('getDaily', () => {
    it('should return 0 consumed when no entries', async () => {
      prisma.waterLog.findMany.mockResolvedValue([]);
      const result = await service.getDaily('user-uuid');
      expect(result.consumed).toBe(0);
      expect(result.target).toBe(DEFAULT_WATER_TARGET_ML);
      expect(result.entries).toHaveLength(0);
    });

    it('should sum all entries for the day', async () => {
      prisma.waterLog.findMany.mockResolvedValue([
        { ...mockEntry, amountMl: 250 },
        { ...mockEntry, id: 'wl-2', amountMl: 500 },
        { ...mockEntry, id: 'wl-3', amountMl: 250 },
      ]);
      const result = await service.getDaily('user-uuid', '2026-03-21');
      expect(result.consumed).toBe(1000);
      expect(result.entries).toHaveLength(3);
    });

    it('should use profile waterTargetMl over default', async () => {
      prisma.profile.findUnique.mockResolvedValue({ waterTargetMl: 2500 });
      const result = await service.getDaily('user-uuid');
      expect(result.target).toBe(2500);
    });

    it('should fall back to default target when profile has none', async () => {
      prisma.profile.findUnique.mockResolvedValue(null);
      const result = await service.getDaily('user-uuid');
      expect(result.target).toBe(DEFAULT_WATER_TARGET_ML);
    });

    it('should use UTC day boundaries when dateStr provided', async () => {
      await service.getDaily('user-uuid', '2026-03-21');
      const whereArg = prisma.waterLog.findMany.mock.calls[0][0].where;
      expect(whereArg.loggedAt.gte.toISOString()).toBe('2026-03-21T00:00:00.000Z');
      expect(whereArg.loggedAt.lt.toISOString()).toBe('2026-03-22T00:00:00.000Z');
    });
  });

  describe('deleteLast', () => {
    it('should return deleted: false when no entries today', async () => {
      prisma.waterLog.findFirst.mockResolvedValue(null);
      const result = await service.deleteLast('user-uuid');
      expect(result.deleted).toBe(false);
      expect(prisma.waterLog.delete).not.toHaveBeenCalled();
    });

    it('should delete the most recent entry and return deleted: true', async () => {
      prisma.waterLog.findFirst.mockResolvedValue(mockEntry);
      const result = await service.deleteLast('user-uuid');
      expect(result.deleted).toBe(true);
      expect(prisma.waterLog.delete).toHaveBeenCalledWith({ where: { id: 'wl-uuid' } });
    });
  });
});
