import { StreaksService } from './streaks.service';
import { PrismaService } from '../prisma';

describe('StreaksService', () => {
  let service: StreaksService;
  let prisma: { $queryRaw: jest.Mock };

  // Use UTC dates to match toDateKeyInTZ(new Date(), undefined) which defaults to UTC.
  function dateKey(daysAgo: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - daysAgo);
    const y = d.getUTCFullYear();
    const m = `${d.getUTCMonth() + 1}`.padStart(2, '0');
    const day = `${d.getUTCDate()}`.padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function rows(daysAgo: number[]): { log_date: string }[] {
    return daysAgo.map((n) => ({ log_date: dateKey(n) }));
  }

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn() };
    service = new StreaksService(prisma as unknown as PrismaService);
  });

  describe('currentStreak', () => {
    it('returns 0 when user has never logged', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      const result = await service.getStreaks('u1');
      expect(result.currentStreak).toBe(0);
    });

    it('returns 1 when only today is logged', async () => {
      prisma.$queryRaw.mockResolvedValue(rows([0]));
      const result = await service.getStreaks('u1');
      expect(result.currentStreak).toBe(1);
    });

    it('counts consecutive days including today', async () => {
      prisma.$queryRaw.mockResolvedValue(rows([0, 1, 2, 3]));
      const result = await service.getStreaks('u1');
      expect(result.currentStreak).toBe(4);
    });

    it('uses yesterday as base when today is not yet logged (grace period)', async () => {
      // logged 1, 2, 3 days ago but not today
      prisma.$queryRaw.mockResolvedValue(rows([1, 2, 3]));
      const result = await service.getStreaks('u1');
      expect(result.currentStreak).toBe(3);
    });

    it('resets to 0 when last log was 2+ days ago', async () => {
      prisma.$queryRaw.mockResolvedValue(rows([2, 3, 4]));
      const result = await service.getStreaks('u1');
      expect(result.currentStreak).toBe(0);
    });

    it('stops counting at a gap', async () => {
      // logged today + days 1, 2, then a gap at 3, then 4, 5
      prisma.$queryRaw.mockResolvedValue(rows([0, 1, 2, 4, 5]));
      const result = await service.getStreaks('u1');
      expect(result.currentStreak).toBe(3);
    });
  });

  describe('longestStreak', () => {
    it('returns 0 for no logs', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      const result = await service.getStreaks('u1');
      expect(result.longestStreak).toBe(0);
    });

    it('returns 1 for a single log', async () => {
      prisma.$queryRaw.mockResolvedValue(rows([5]));
      const result = await service.getStreaks('u1');
      expect(result.longestStreak).toBe(1);
    });

    it('correctly identifies longest streak across gaps', async () => {
      // [10,9,8,7] = 4 days; [4,3,2,1,0] = 5 days — longest is 5
      prisma.$queryRaw.mockResolvedValue(rows([10, 9, 8, 7, 4, 3, 2, 1, 0]));
      const result = await service.getStreaks('u1');
      expect(result.longestStreak).toBe(5);
    });
  });

  describe('consistency', () => {
    it('weekConsistency is 0 when no logs in past 7 days', async () => {
      prisma.$queryRaw.mockResolvedValue(rows([8, 9, 10]));
      const result = await service.getStreaks('u1');
      expect(result.weekConsistency).toBe(0);
    });

    it('weekConsistency is 100 when all 7 days logged', async () => {
      prisma.$queryRaw.mockResolvedValue(rows([0, 1, 2, 3, 4, 5, 6]));
      const result = await service.getStreaks('u1');
      expect(result.weekConsistency).toBe(100);
    });

    it('monthConsistency rounds correctly for 15/30 logged days', async () => {
      prisma.$queryRaw.mockResolvedValue(
        rows([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28]),
      );
      const result = await service.getStreaks('u1');
      expect(result.monthConsistency).toBe(50);
    });
  });

  describe('todayLogged', () => {
    it('is false when no logs today', async () => {
      prisma.$queryRaw.mockResolvedValue(rows([1, 2]));
      const result = await service.getStreaks('u1');
      expect(result.todayLogged).toBe(false);
    });

    it('is true when today is logged', async () => {
      prisma.$queryRaw.mockResolvedValue(rows([0, 1]));
      const result = await service.getStreaks('u1');
      expect(result.todayLogged).toBe(true);
    });
  });

  describe('calendar', () => {
    it('returns exactly 30 days', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      const result = await service.getStreaks('u1');
      expect(result.calendar).toHaveLength(30);
    });

    it('marks today as logged when meals exist', async () => {
      prisma.$queryRaw.mockResolvedValue(rows([0]));
      const result = await service.getStreaks('u1');
      const todayEntry = result.calendar[result.calendar.length - 1];
      expect(todayEntry?.logged).toBe(true);
    });

    it('calendar is in ascending date order', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      const result = await service.getStreaks('u1');
      for (let i = 1; i < result.calendar.length; i++) {
        expect(result.calendar[i]!.date > result.calendar[i - 1]!.date).toBe(true);
      }
    });
  });
});
