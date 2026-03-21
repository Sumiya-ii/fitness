import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { RemindersService } from './reminders.service';
import { PrismaService } from '../prisma';
import { QUEUE_NAMES } from '@coach/shared';

describe('RemindersService', () => {
  let service: RemindersService;
  let prisma: {
    notificationPreference: { findMany: jest.Mock };
    mealLog: { count: jest.Mock };
    telegramLink: { findUnique: jest.Mock };
    profile: { findUnique: jest.Mock };
    deviceToken: { findMany: jest.Mock };
  };
  let reminderQueue: { add: jest.Mock };

  beforeEach(async () => {
    reminderQueue = { add: jest.fn().mockResolvedValue({}) };
    prisma = {
      notificationPreference: { findMany: jest.fn() },
      mealLog: { count: jest.fn() },
      telegramLink: { findUnique: jest.fn().mockResolvedValue(null) },
      profile: { findUnique: jest.fn().mockResolvedValue({ locale: 'mn' }) },
      deviceToken: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemindersService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(QUEUE_NAMES.REMINDERS), useValue: reminderQueue },
      ],
    }).compile();

    service = module.get<RemindersService>(RemindersService);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('isInQuietHours', () => {
    it('returns false when quietStart or quietEnd is null', () => {
      expect(service.isInQuietHours('Asia/Ulaanbaatar', null, '07:00')).toBe(false);
      expect(service.isInQuietHours('Asia/Ulaanbaatar', '22:00', null)).toBe(false);
      expect(service.isInQuietHours('Asia/Ulaanbaatar', null, null)).toBe(false);
    });

    it('returns true when current time is within quiet hours (no midnight span)', () => {
      // 10:30 AM in Asia/Ulaanbaatar (UTC+8): set UTC to 02:30
      jest.setSystemTime(new Date('2026-03-04T02:30:00Z'));
      // Quiet hours 09:00-12:00 local
      expect(service.isInQuietHours('Asia/Ulaanbaatar', '09:00', '12:00')).toBe(true);
    });

    it('returns false when current time is outside quiet hours (no midnight span)', () => {
      jest.setSystemTime(new Date('2026-03-04T02:30:00Z')); // 10:30 AM Ulaanbaatar
      // Quiet hours 22:00-23:00 local - we're not in that range
      expect(service.isInQuietHours('Asia/Ulaanbaatar', '22:00', '23:00')).toBe(false);
    });

    it('returns true when in quiet hours spanning midnight (e.g. 22:00-07:00)', () => {
      // 23:30 in Asia/Ulaanbaatar = 15:30 UTC
      jest.setSystemTime(new Date('2026-03-04T15:30:00Z'));
      expect(service.isInQuietHours('Asia/Ulaanbaatar', '22:00', '07:00')).toBe(true);
    });

    it('returns true when in early-morning quiet hours spanning midnight', () => {
      // 03:00 in Asia/Ulaanbaatar = 19:00 previous day UTC
      jest.setSystemTime(new Date('2026-03-03T19:00:00Z'));
      expect(service.isInQuietHours('Asia/Ulaanbaatar', '22:00', '07:00')).toBe(true);
    });

    it('returns false when outside quiet hours spanning midnight', () => {
      // 14:00 in Asia/Ulaanbaatar = 06:00 UTC
      jest.setSystemTime(new Date('2026-03-04T06:00:00Z'));
      expect(service.isInQuietHours('Asia/Ulaanbaatar', '22:00', '07:00')).toBe(false);
    });
  });

  describe('scheduleMorningReminders', () => {
    it('enqueues morning reminders for users in 8-9 AM window', async () => {
      // 08:30 in Asia/Ulaanbaatar = 00:30 UTC
      jest.setSystemTime(new Date('2026-03-04T00:30:00Z'));

      prisma.notificationPreference.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          morningReminder: true,
          reminderTimezone: 'Asia/Ulaanbaatar',
          quietHoursStart: null,
          quietHoursEnd: null,
          channels: ['push'],
        },
      ]);

      const count = await service.scheduleMorningReminders();

      expect(count).toBe(1);
      expect(reminderQueue.add).toHaveBeenCalledWith(
        'morning',
        expect.objectContaining({
          userId: 'user-1',
          type: 'morning',
          channels: ['push'],
        }),
        expect.any(Object),
      );
    });

    it('skips users outside 8-9 AM window', async () => {
      // 10:00 in Asia/Ulaanbaatar = 02:00 UTC
      jest.setSystemTime(new Date('2026-03-04T02:00:00Z'));

      prisma.notificationPreference.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          morningReminder: true,
          reminderTimezone: 'Asia/Ulaanbaatar',
          quietHoursStart: null,
          quietHoursEnd: null,
          channels: ['push'],
        },
      ]);

      const count = await service.scheduleMorningReminders();

      expect(count).toBe(0);
      expect(reminderQueue.add).not.toHaveBeenCalled();
    });

    it('skips users in quiet hours', async () => {
      // 08:30 in Asia/Ulaanbaatar
      jest.setSystemTime(new Date('2026-03-04T00:30:00Z'));

      prisma.notificationPreference.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          morningReminder: true,
          reminderTimezone: 'Asia/Ulaanbaatar',
          quietHoursStart: '07:00',
          quietHoursEnd: '09:00',
          channels: ['push'],
        },
      ]);

      const count = await service.scheduleMorningReminders();

      expect(count).toBe(0);
      expect(reminderQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('scheduleEveningReminders', () => {
    it('enqueues evening reminders for users with no meals today', async () => {
      // 20:30 in Asia/Ulaanbaatar = 12:30 UTC
      jest.setSystemTime(new Date('2026-03-04T12:30:00Z'));

      prisma.notificationPreference.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          eveningReminder: true,
          reminderTimezone: 'Asia/Ulaanbaatar',
          quietHoursStart: null,
          quietHoursEnd: null,
          channels: ['push', 'telegram'],
        },
      ]);
      prisma.mealLog.count.mockResolvedValue(0);

      const count = await service.scheduleEveningReminders();

      expect(count).toBe(1);
      expect(reminderQueue.add).toHaveBeenCalledWith(
        'evening',
        expect.objectContaining({
          userId: 'user-1',
          type: 'evening',
          channels: ['push', 'telegram'],
        }),
        expect.any(Object),
      );
    });

    it('skips users who have logged meals today', async () => {
      jest.setSystemTime(new Date('2026-03-04T12:30:00Z'));

      prisma.notificationPreference.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          eveningReminder: true,
          reminderTimezone: 'Asia/Ulaanbaatar',
          quietHoursStart: null,
          quietHoursEnd: null,
          channels: ['push'],
        },
      ]);
      prisma.mealLog.count.mockResolvedValue(2);

      const count = await service.scheduleEveningReminders();

      expect(count).toBe(0);
      expect(reminderQueue.add).not.toHaveBeenCalled();
    });

    it('skips users outside 8-9 PM window', async () => {
      // 19:00 in Asia/Ulaanbaatar = 11:00 UTC
      jest.setSystemTime(new Date('2026-03-04T11:00:00Z'));

      prisma.notificationPreference.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          eveningReminder: true,
          reminderTimezone: 'Asia/Ulaanbaatar',
          quietHoursStart: null,
          quietHoursEnd: null,
          channels: ['push'],
        },
      ]);

      const count = await service.scheduleEveningReminders();

      expect(count).toBe(0);
      expect(reminderQueue.add).not.toHaveBeenCalled();
    });
  });
});
