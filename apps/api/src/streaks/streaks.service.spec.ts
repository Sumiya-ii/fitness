import { StreaksService } from './streaks.service';
import { PrismaService } from '../prisma';

describe('StreaksService', () => {
  let service: StreaksService;
  let prisma: { $queryRaw: jest.Mock; profile: { findUnique: jest.Mock } };

  // Produce YYYY-MM-DD keys relative to today in UTC (used when tz is not set
  // and profile returns no timezone so the service falls back to Asia/Ulaanbaatar,
  // but for these tests we pass an explicit UTC tz to keep assertions deterministic).
  function utcDateKey(daysAgo: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - daysAgo);
    const y = d.getUTCFullYear();
    const m = `${d.getUTCMonth() + 1}`.padStart(2, '0');
    const day = `${d.getUTCDate()}`.padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function rows(daysAgo: number[]): { log_date: string }[] {
    return daysAgo.map((n) => ({ log_date: utcDateKey(n) }));
  }

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn(),
      profile: { findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }) },
    };
    service = new StreaksService(prisma as unknown as PrismaService);
  });

  // All streak/calendar tests pass tz='UTC' so date arithmetic is deterministic
  // regardless of when/where the test runner executes.

  describe('currentStreak', () => {
    it('returns 0 when user has never logged', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      const result = await service.getStreaks('u1', 'UTC');
      expect(result.currentStreak).toBe(0);
    });

    it('returns 1 when only today is logged', async () => {
      prisma.$queryRaw.mockResolvedValue(rows([0]));
      const result = await service.getStreaks('u1', 'UTC');
      expect(result.currentStreak).toBe(1);
    });

    it('counts consecutive days including today', async () => {
      prisma.$queryRaw.mockResolvedValue(rows([0, 1, 2, 3]));
      const result = await service.getStreaks('u1', 'UTC');
      expect(result.currentStreak).toBe(4);
    });

    it('uses yesterday as base when today is not yet logged (grace period)', async () => {
      prisma.$queryRaw.mockResolvedValue(rows([1, 2, 3]));
      const result = await service.getStreaks('u1', 'UTC');
      expect(result.currentStreak).toBe(3);
    });

    it('resets to 0 when last log was 2+ days ago', async () => {
      prisma.$queryRaw.mockResolvedValue(rows([2, 3, 4]));
      const result = await service.getStreaks('u1', 'UTC');
      expect(result.currentStreak).toBe(0);
    });

    it('stops counting at a gap', async () => {
      prisma.$queryRaw.mockResolvedValue(rows([0, 1, 2, 4, 5]));
      const result = await service.getStreaks('u1', 'UTC');
      expect(result.currentStreak).toBe(3);
    });
  });

  describe('longestStreak', () => {
    it('returns 0 for no logs', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      const result = await service.getStreaks('u1', 'UTC');
      expect(result.longestStreak).toBe(0);
    });

    it('returns 1 for a single log', async () => {
      prisma.$queryRaw.mockResolvedValue(rows([5]));
      const result = await service.getStreaks('u1', 'UTC');
      expect(result.longestStreak).toBe(1);
    });

    it('correctly identifies longest streak across gaps', async () => {
      // [10,9,8,7] = 4 days; [4,3,2,1,0] = 5 days — longest is 5
      prisma.$queryRaw.mockResolvedValue(rows([10, 9, 8, 7, 4, 3, 2, 1, 0]));
      const result = await service.getStreaks('u1', 'UTC');
      expect(result.longestStreak).toBe(5);
    });
  });

  describe('consistency', () => {
    it('weekConsistency is 0 when no logs in past 7 days', async () => {
      prisma.$queryRaw.mockResolvedValue(rows([8, 9, 10]));
      const result = await service.getStreaks('u1', 'UTC');
      expect(result.weekConsistency).toBe(0);
    });

    it('weekConsistency is 100 when all 7 days logged', async () => {
      prisma.$queryRaw.mockResolvedValue(rows([0, 1, 2, 3, 4, 5, 6]));
      const result = await service.getStreaks('u1', 'UTC');
      expect(result.weekConsistency).toBe(100);
    });

    it('monthConsistency rounds correctly for 15/30 logged days', async () => {
      prisma.$queryRaw.mockResolvedValue(
        rows([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28]),
      );
      const result = await service.getStreaks('u1', 'UTC');
      expect(result.monthConsistency).toBe(50);
    });
  });

  describe('todayLogged', () => {
    it('is false when no logs today', async () => {
      prisma.$queryRaw.mockResolvedValue(rows([1, 2]));
      const result = await service.getStreaks('u1', 'UTC');
      expect(result.todayLogged).toBe(false);
    });

    it('is true when today is logged', async () => {
      prisma.$queryRaw.mockResolvedValue(rows([0, 1]));
      const result = await service.getStreaks('u1', 'UTC');
      expect(result.todayLogged).toBe(true);
    });
  });

  describe('calendar', () => {
    it('returns exactly 30 days', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      const result = await service.getStreaks('u1', 'UTC');
      expect(result.calendar).toHaveLength(30);
    });

    it('marks today as logged when meals exist', async () => {
      prisma.$queryRaw.mockResolvedValue(rows([0]));
      const result = await service.getStreaks('u1', 'UTC');
      const todayEntry = result.calendar[result.calendar.length - 1];
      expect(todayEntry?.logged).toBe(true);
    });

    it('calendar is in ascending date order', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      const result = await service.getStreaks('u1', 'UTC');
      for (let i = 1; i < result.calendar.length; i++) {
        expect(result.calendar[i]!.date > result.calendar[i - 1]!.date).toBe(true);
      }
    });
  });

  describe('timezone resolution', () => {
    it('uses caller-supplied tz over profile timezone', async () => {
      prisma.profile.findUnique.mockResolvedValue({ timezone: 'America/New_York' });
      prisma.$queryRaw.mockResolvedValue([]);
      await service.getStreaks('u1', 'Europe/London');
      // profile lookup should be skipped — no DB call for profile
      expect(prisma.profile.findUnique).not.toHaveBeenCalled();
    });

    it('falls back to profile timezone when no caller tz', async () => {
      prisma.profile.findUnique.mockResolvedValue({ timezone: 'Asia/Tokyo' });
      prisma.$queryRaw.mockResolvedValue([]);
      await service.getStreaks('u1');
      expect(prisma.profile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        select: { timezone: true },
      });
      // The SQL query should use Asia/Tokyo
      const sqlCall = prisma.$queryRaw.mock.calls[0];
      expect(JSON.stringify(sqlCall)).toContain('Asia/Tokyo');
    });

    it('falls back to Asia/Ulaanbaatar when profile has no timezone', async () => {
      prisma.profile.findUnique.mockResolvedValue({ timezone: null });
      prisma.$queryRaw.mockResolvedValue([]);
      await service.getStreaks('u1');
      const sqlCall = prisma.$queryRaw.mock.calls[0];
      expect(JSON.stringify(sqlCall)).toContain('Asia/Ulaanbaatar');
    });

    it('falls back to Asia/Ulaanbaatar when profile not found', async () => {
      prisma.profile.findUnique.mockResolvedValue(null);
      prisma.$queryRaw.mockResolvedValue([]);
      await service.getStreaks('u1');
      const sqlCall = prisma.$queryRaw.mock.calls[0];
      expect(JSON.stringify(sqlCall)).toContain('Asia/Ulaanbaatar');
    });

    it('ignores invalid tz string and falls back to profile timezone', async () => {
      prisma.profile.findUnique.mockResolvedValue({ timezone: 'Asia/Ulaanbaatar' });
      prisma.$queryRaw.mockResolvedValue([]);
      await service.getStreaks('u1', 'Not/AReal_Zone');
      // Invalid tz → profile lookup happens
      expect(prisma.profile.findUnique).toHaveBeenCalled();
    });

    it('23:55 UTC is already next day in Asia/Ulaanbaatar (+8)', () => {
      // 2026-04-29T23:55:00Z → 2026-04-30 in +8 zone
      const date = new Date('2026-04-29T23:55:00.000Z');
      const ulaanbaatar = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ulaanbaatar',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
      expect(ulaanbaatar).toBe('2026-04-30');
    });

    it('23:55 UTC is still same day in UTC', () => {
      const date = new Date('2026-04-29T23:55:00.000Z');
      const utc = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
      expect(utc).toBe('2026-04-29');
    });

    it('23:55 UTC is previous day in America/New_York (-4 in summer)', () => {
      // 2026-04-29T23:55:00Z → 2026-04-29T19:55:00 New York — still same UTC date
      const date = new Date('2026-04-29T23:55:00.000Z');
      const ny = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
      expect(ny).toBe('2026-04-29');
    });
  });
});
