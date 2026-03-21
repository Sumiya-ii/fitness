import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@coach/shared';
import { CoachService } from './coach.service';
import { CoachContextService } from './coach-context.service';
import { PrismaService } from '../prisma';
import { ConfigService } from '../config';
import { CoachContext } from './coach.types';

// Mock ioredis
jest.mock('ioredis', () => {
  const store = new Map<string, string>();
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, val: string) => store.set(key, val)),
    setex: jest.fn(async (key: string, _ttl: number, val: string) => store.set(key, val)),
    incr: jest.fn(async (key: string) => {
      const cur = parseInt(store.get(key) ?? '0', 10);
      store.set(key, String(cur + 1));
      return cur + 1;
    }),
    expire: jest.fn(async () => 1),
    disconnect: jest.fn(),
    _store: store,
    _reset: () => store.clear(),
  }));
});

function makeContext(overrides: Partial<CoachContext['today']> = {}): CoachContext {
  return {
    userName: 'Bat',
    locale: 'mn',
    today: {
      mealsLogged: 0,
      caloriesConsumed: 0,
      caloriesTarget: 2000,
      proteinConsumed: 0,
      proteinTarget: 150,
      carbsConsumed: 0,
      fatConsumed: 0,
      waterMl: 0,
      waterTarget: 2000,
      mealTypes: [],
      ...overrides,
    },
    streak: { mealLoggingDays: 0, waterGoalDays: 0 },
    weekly: { avgDailyCalories: 1800, avgMealsPerDay: 2.5, daysWithWaterGoalMet: 3, totalDays: 7 },
    messageType: 'morning_greeting',
    localTime: '08:00',
  };
}

describe('CoachService', () => {
  let service: CoachService;
  let coachQueue: { add: jest.Mock };
  let contextService: { buildContext: jest.Mock };

  beforeEach(async () => {
    coachQueue = { add: jest.fn().mockResolvedValue({}) };
    contextService = { buildContext: jest.fn() };

    const prisma = {
      notificationPreference: { findMany: jest.fn().mockResolvedValue([]) },
      telegramLink: { findUnique: jest.fn().mockResolvedValue(null) },
      profile: { findUnique: jest.fn().mockResolvedValue({ locale: 'mn' }) },
      deviceToken: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoachService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('redis://localhost') },
        },
        { provide: CoachContextService, useValue: contextService },
        { provide: getQueueToken(QUEUE_NAMES.COACH_MESSAGES), useValue: coachQueue },
      ],
    }).compile();

    service = module.get<CoachService>(CoachService);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    // Reset the ioredis mock store between tests
    const Redis = require('ioredis');
    const instance = new Redis();
    instance._reset?.();
  });

  describe('canSend', () => {
    it('returns true when no cooldown or daily cap hit', async () => {
      jest.setSystemTime(new Date('2026-03-04T00:30:00Z')); // 8:30 AM UB
      const result = await service.canSend('user-1', 'morning_greeting', 'Asia/Ulaanbaatar');
      expect(result).toBe(true);
    });

    it('returns false after markSent sets cooldown', async () => {
      jest.setSystemTime(new Date('2026-03-04T00:30:00Z'));
      await service.markSent('user-1', 'morning_greeting', 'Asia/Ulaanbaatar');
      const result = await service.canSend('user-1', 'morning_greeting', 'Asia/Ulaanbaatar');
      expect(result).toBe(false);
    });
  });

  describe('scheduleCoachMessages', () => {
    it('returns 0 when no users in preferences', async () => {
      jest.setSystemTime(new Date('2026-03-04T00:30:00Z'));
      const count = await service.scheduleCoachMessages();
      expect(count).toBe(0);
      expect(coachQueue.add).not.toHaveBeenCalled();
    });

    it('enqueues morning_greeting at 8:00 AM with 0 meals', async () => {
      // 8:00 AM Asia/Ulaanbaatar = 00:00 UTC
      jest.setSystemTime(new Date('2026-03-04T00:00:00Z'));

      const prismaMock = {
        notificationPreference: {
          findMany: jest.fn().mockResolvedValue([
            {
              userId: 'user-1',
              reminderTimezone: 'Asia/Ulaanbaatar',
              channels: ['push'],
              quietHoursStart: null,
              quietHoursEnd: null,
            },
          ]),
        },
        telegramLink: { findUnique: jest.fn().mockResolvedValue(null) },
        profile: { findUnique: jest.fn().mockResolvedValue({ locale: 'mn' }) },
        deviceToken: { findMany: jest.fn().mockResolvedValue([{ token: 'expo-token' }]) },
      };

      contextService.buildContext.mockResolvedValue(makeContext());

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CoachService,
          { provide: PrismaService, useValue: prismaMock },
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue('redis://localhost') },
          },
          { provide: CoachContextService, useValue: contextService },
          { provide: getQueueToken(QUEUE_NAMES.COACH_MESSAGES), useValue: coachQueue },
        ],
      }).compile();

      const svc = module.get<CoachService>(CoachService);

      const count = await svc.scheduleCoachMessages();

      expect(count).toBe(1);
      expect(coachQueue.add).toHaveBeenCalledWith(
        'morning_greeting',
        expect.objectContaining({
          userId: 'user-1',
          messageType: 'morning_greeting',
          channels: ['push'],
          pushTokens: ['expo-token'],
        }),
        expect.any(Object),
      );
    });

    it('skips users in quiet hours', async () => {
      // 8:00 AM Asia/Ulaanbaatar
      jest.setSystemTime(new Date('2026-03-04T00:00:00Z'));

      const prismaMock = {
        notificationPreference: {
          findMany: jest.fn().mockResolvedValue([
            {
              userId: 'user-1',
              reminderTimezone: 'Asia/Ulaanbaatar',
              channels: ['push'],
              quietHoursStart: '07:00',
              quietHoursEnd: '09:00',
            },
          ]),
        },
        telegramLink: { findUnique: jest.fn().mockResolvedValue(null) },
        profile: { findUnique: jest.fn().mockResolvedValue({ locale: 'mn' }) },
        deviceToken: { findMany: jest.fn().mockResolvedValue([]) },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CoachService,
          { provide: PrismaService, useValue: prismaMock },
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue('redis://localhost') },
          },
          { provide: CoachContextService, useValue: contextService },
          { provide: getQueueToken(QUEUE_NAMES.COACH_MESSAGES), useValue: coachQueue },
        ],
      }).compile();

      const svc = module.get<CoachService>(CoachService);
      const count = await svc.scheduleCoachMessages();

      expect(count).toBe(0);
      expect(coachQueue.add).not.toHaveBeenCalled();
    });

    it('selects water_reminder when water < 250ml at 10:30 AM', async () => {
      // 10:30 AM Asia/Ulaanbaatar = 02:30 UTC
      jest.setSystemTime(new Date('2026-03-04T02:30:00Z'));

      contextService.buildContext.mockResolvedValue(makeContext({ waterMl: 100, mealsLogged: 1 }));

      const prismaMock = {
        notificationPreference: {
          findMany: jest.fn().mockResolvedValue([
            {
              userId: 'user-2',
              reminderTimezone: 'Asia/Ulaanbaatar',
              channels: ['push'],
              quietHoursStart: null,
              quietHoursEnd: null,
            },
          ]),
        },
        telegramLink: { findUnique: jest.fn().mockResolvedValue(null) },
        profile: { findUnique: jest.fn().mockResolvedValue({ locale: 'mn' }) },
        deviceToken: { findMany: jest.fn().mockResolvedValue([{ token: 'tok' }]) },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CoachService,
          { provide: PrismaService, useValue: prismaMock },
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue('redis://localhost') },
          },
          { provide: CoachContextService, useValue: contextService },
          { provide: getQueueToken(QUEUE_NAMES.COACH_MESSAGES), useValue: coachQueue },
        ],
      }).compile();

      const svc = module.get<CoachService>(CoachService);
      const count = await svc.scheduleCoachMessages();

      expect(count).toBe(1);
      expect(coachQueue.add).toHaveBeenCalledWith(
        'water_reminder',
        expect.objectContaining({ messageType: 'water_reminder' }),
        expect.any(Object),
      );
    });

    it('selects progress_feedback at 8:30 PM when meals > 0', async () => {
      // 8:30 PM Asia/Ulaanbaatar = 12:30 UTC
      jest.setSystemTime(new Date('2026-03-04T12:30:00Z'));

      contextService.buildContext.mockResolvedValue(
        makeContext({ mealsLogged: 2, caloriesConsumed: 1600, waterMl: 1800 }),
      );

      const prismaMock = {
        notificationPreference: {
          findMany: jest.fn().mockResolvedValue([
            {
              userId: 'user-3',
              reminderTimezone: 'Asia/Ulaanbaatar',
              channels: ['push', 'telegram'],
              quietHoursStart: null,
              quietHoursEnd: null,
            },
          ]),
        },
        telegramLink: {
          findUnique: jest.fn().mockResolvedValue({ active: true, chatId: 'chat-123' }),
        },
        profile: { findUnique: jest.fn().mockResolvedValue({ locale: 'mn' }) },
        deviceToken: { findMany: jest.fn().mockResolvedValue([{ token: 'tok2' }]) },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CoachService,
          { provide: PrismaService, useValue: prismaMock },
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue('redis://localhost') },
          },
          { provide: CoachContextService, useValue: contextService },
          { provide: getQueueToken(QUEUE_NAMES.COACH_MESSAGES), useValue: coachQueue },
        ],
      }).compile();

      const svc = module.get<CoachService>(CoachService);
      const count = await svc.scheduleCoachMessages();

      expect(count).toBe(1);
      expect(coachQueue.add).toHaveBeenCalledWith(
        'progress_feedback',
        expect.objectContaining({
          messageType: 'progress_feedback',
          chatId: 'chat-123',
        }),
        expect.any(Object),
      );
    });
  });
});
