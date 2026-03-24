import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { MealNudgeService } from './meal-nudge.service';
import { PrismaService } from '../prisma';
import { QUEUE_NAMES } from '@coach/shared';

describe('MealNudgeService', () => {
  let service: MealNudgeService;
  let prisma: {
    notificationPreference: { findMany: jest.Mock };
    mealLog: { count: jest.Mock };
    telegramLink: { findUnique: jest.Mock };
    profile: { findUnique: jest.Mock };
    deviceToken: { findMany: jest.Mock };
  };
  let nudgeQueue: { add: jest.Mock };

  beforeEach(async () => {
    nudgeQueue = { add: jest.fn().mockResolvedValue({}) };
    prisma = {
      notificationPreference: { findMany: jest.fn() },
      mealLog: { count: jest.fn() },
      telegramLink: { findUnique: jest.fn().mockResolvedValue(null) },
      profile: { findUnique: jest.fn().mockResolvedValue({ locale: 'mn' }) },
      deviceToken: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MealNudgeService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(QUEUE_NAMES.MEAL_NUDGE), useValue: nudgeQueue },
      ],
    }).compile();

    service = module.get<MealNudgeService>(MealNudgeService);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('enqueues nudge for user with exactly 1 meal at 8 PM local time', async () => {
    // 20:30 in Asia/Ulaanbaatar = 12:30 UTC
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
    prisma.mealLog.count.mockResolvedValue(1);

    const count = await service.scheduleMealNudges();

    expect(count).toBe(1);
    expect(nudgeQueue.add).toHaveBeenCalledWith(
      'meal-nudge',
      expect.objectContaining({ userId: 'user-1', mealCount: 1 }),
      expect.any(Object),
    );
  });

  it('skips user with 0 meals (handled by evening reminder)', async () => {
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
    prisma.mealLog.count.mockResolvedValue(0);

    const count = await service.scheduleMealNudges();

    expect(count).toBe(0);
    expect(nudgeQueue.add).not.toHaveBeenCalled();
  });

  it('skips user with 2+ meals already logged', async () => {
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

    const count = await service.scheduleMealNudges();

    expect(count).toBe(0);
    expect(nudgeQueue.add).not.toHaveBeenCalled();
  });

  it('skips users outside 8–9 PM window', async () => {
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

    const count = await service.scheduleMealNudges();

    expect(count).toBe(0);
    expect(nudgeQueue.add).not.toHaveBeenCalled();
  });

  it('includes Telegram chatId and push tokens when available', async () => {
    jest.setSystemTime(new Date('2026-03-04T12:30:00Z'));

    prisma.notificationPreference.findMany.mockResolvedValue([
      {
        userId: 'user-2',
        eveningReminder: true,
        reminderTimezone: 'Asia/Ulaanbaatar',
        quietHoursStart: null,
        quietHoursEnd: null,
        channels: ['push', 'telegram'],
      },
    ]);
    prisma.mealLog.count.mockResolvedValue(1);
    prisma.telegramLink.findUnique.mockResolvedValue({ active: true, chatId: 'chat-99' });
    prisma.deviceToken.findMany.mockResolvedValue([{ token: 'expo-token-abc' }]);

    await service.scheduleMealNudges();

    expect(nudgeQueue.add).toHaveBeenCalledWith(
      'meal-nudge',
      expect.objectContaining({
        userId: 'user-2',
        chatId: 'chat-99',
        pushTokens: ['expo-token-abc'],
        channels: ['push', 'telegram'],
      }),
      expect.any(Object),
    );
  });
});
