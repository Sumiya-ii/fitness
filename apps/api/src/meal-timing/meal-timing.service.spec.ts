import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { DateTime } from 'luxon';
import { QUEUE_NAMES } from '@coach/shared';
import { MealTimingService } from './meal-timing.service';
import { PrismaService } from '../prisma';
import { ConfigService } from '../config';

jest.mock('ioredis', () => {
  const store = new Map<string, string>();
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    setex: jest.fn(async (key: string, _ttl: number, val: string) => store.set(key, val)),
    disconnect: jest.fn(),
    _store: store,
    _reset: () => store.clear(),
  }));
});

const TIMEZONE = 'Asia/Ulaanbaatar';
const lastMonday = DateTime.fromISO('2026-03-16', { zone: TIMEZONE }); // Mon

function makeMealLog(isoDatetime: string, mealType: string | null) {
  return { loggedAt: new Date(isoDatetime), mealType };
}

describe('MealTimingService.computeInsights', () => {
  let service: MealTimingService;

  beforeEach(async () => {
    const queue = { add: jest.fn().mockResolvedValue({}) };
    const prisma = {
      mealLog: { findMany: jest.fn().mockResolvedValue([]) },
      notificationPreference: { findMany: jest.fn().mockResolvedValue([]) },
      profile: { findUnique: jest.fn().mockResolvedValue(null) },
      telegramLink: { findUnique: jest.fn().mockResolvedValue(null) },
      deviceToken: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MealTimingService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('redis://localhost') },
        },
        { provide: getQueueToken(QUEUE_NAMES.MEAL_TIMING_INSIGHTS), useValue: queue },
      ],
    }).compile();

    service = module.get<MealTimingService>(MealTimingService);
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Redis = require('ioredis');
    const instance = new Redis();
    instance._reset?.();
  });

  it('returns empty mealStats and zeroed metrics when no logs', () => {
    const result = service.computeInsights([], TIMEZONE, lastMonday);

    expect(result.weekStart).toBe('2026-03-16');
    expect(result.weekEnd).toBe('2026-03-22');
    expect(result.mealStats).toHaveLength(0);
    expect(result.breakfastWeekdayRate).toBe(0);
    expect(result.breakfastWeekendRate).toBe(0);
    expect(result.lateNightEatingDays).toBe(0);
    expect(result.avgEatingWindowMinutes).toBeNull();
  });

  it('computes average breakfast hour correctly', () => {
    // Two breakfast logs: 08:00 and 09:00 → avg = 08:30
    const logs = [
      makeMealLog('2026-03-16T00:00:00Z', 'breakfast'), // 08:00 UB (UTC+8)
      makeMealLog('2026-03-17T01:00:00Z', 'breakfast'), // 09:00 UB
    ];

    const result = service.computeInsights(logs, TIMEZONE, lastMonday);

    const breakfastStat = result.mealStats.find((s) => s.mealType === 'breakfast');
    expect(breakfastStat).toBeDefined();
    expect(breakfastStat!.avgHour).toBeCloseTo(8.5, 1);
    expect(breakfastStat!.count).toBe(2);
  });

  it('correctly counts breakfast weekday rate', () => {
    // Mon, Tue, Wed = 3 of 5 weekdays have breakfast
    const logs = [
      makeMealLog('2026-03-16T00:00:00Z', 'breakfast'), // Mon 08:00 UB
      makeMealLog('2026-03-17T00:00:00Z', 'breakfast'), // Tue 08:00 UB
      makeMealLog('2026-03-18T00:00:00Z', 'breakfast'), // Wed 08:00 UB
    ];

    const result = service.computeInsights(logs, TIMEZONE, lastMonday);

    expect(result.breakfastWeekdayRate).toBe(60); // 3/5 = 60%
  });

  it('detects late-night eating after 20:00', () => {
    // 21:00 UB = 13:00 UTC
    const logs = [
      makeMealLog('2026-03-16T13:00:00Z', 'snack'), // 21:00 UB = late night
      makeMealLog('2026-03-17T13:00:00Z', 'snack'), // 21:00 UB = late night
    ];

    const result = service.computeInsights(logs, TIMEZONE, lastMonday);

    expect(result.lateNightEatingDays).toBe(2);
  });

  it('does not flag 19:59 as late-night eating', () => {
    // 19:59 UB = 11:59 UTC
    const logs = [makeMealLog('2026-03-16T11:59:00Z', 'dinner')];

    const result = service.computeInsights(logs, TIMEZONE, lastMonday);

    expect(result.lateNightEatingDays).toBe(0);
  });

  it('computes eating window when 2+ meals on a day', () => {
    // Breakfast 08:00, dinner 20:00 → window = 12 hours = 720 minutes
    const logs = [
      makeMealLog('2026-03-16T00:00:00Z', 'breakfast'), // 08:00 UB
      makeMealLog('2026-03-16T12:00:00Z', 'dinner'), // 20:00 UB
    ];

    const result = service.computeInsights(logs, TIMEZONE, lastMonday);

    expect(result.avgEatingWindowMinutes).toBe(720);
  });

  it('returns null eating window when all days have only 1 meal', () => {
    const logs = [
      makeMealLog('2026-03-16T00:00:00Z', 'breakfast'), // only one log on Mon
    ];

    const result = service.computeInsights(logs, TIMEZONE, lastMonday);

    expect(result.avgEatingWindowMinutes).toBeNull();
  });

  it('generates at least one highlight', () => {
    const logs = [
      makeMealLog('2026-03-16T00:00:00Z', 'breakfast'),
      makeMealLog('2026-03-17T00:00:00Z', 'breakfast'),
    ];

    const result = service.computeInsights(logs, TIMEZONE, lastMonday);

    expect(result.highlights.length).toBeGreaterThan(0);
  });

  it('null mealType is treated as snack', () => {
    const logs = [makeMealLog('2026-03-16T04:00:00Z', null)]; // 12:00 UB

    const result = service.computeInsights(logs, TIMEZONE, lastMonday);

    const snackStat = result.mealStats.find((s) => s.mealType === 'snack');
    expect(snackStat).toBeDefined();
  });
});

describe('MealTimingService.scheduleMealTimingInsights', () => {
  it('enqueues job for user whose local time is Monday 9:30 AM', async () => {
    jest.useFakeTimers();
    // Monday 9:30 AM Asia/Ulaanbaatar = 01:30 UTC on Monday
    jest.setSystemTime(new Date('2026-03-23T01:30:00Z'));

    const queue = { add: jest.fn().mockResolvedValue({}) };
    const prisma = {
      notificationPreference: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { userId: 'user-1', reminderTimezone: 'Asia/Ulaanbaatar', channels: ['push'] },
          ]),
      },
      mealLog: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { loggedAt: new Date('2026-03-16T00:00:00Z'), mealType: 'breakfast' },
          ]),
      },
      profile: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ timezone: 'Asia/Ulaanbaatar', displayName: 'Bat' }),
      },
      telegramLink: { findUnique: jest.fn().mockResolvedValue(null) },
      deviceToken: { findMany: jest.fn().mockResolvedValue([{ token: 'expo-tok' }]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MealTimingService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('redis://localhost') },
        },
        { provide: getQueueToken(QUEUE_NAMES.MEAL_TIMING_INSIGHTS), useValue: queue },
      ],
    }).compile();

    const svc = module.get<MealTimingService>(MealTimingService);
    const count = await svc.scheduleMealTimingInsights();

    expect(count).toBe(1);
    expect(queue.add).toHaveBeenCalledWith(
      'meal_timing_insights',
      expect.objectContaining({
        userId: 'user-1',
        userName: 'Bat',
        channels: ['push'],
        pushTokens: ['expo-tok'],
        insights: expect.objectContaining({ weekStart: '2026-03-16' }),
      }),
      expect.objectContaining({ jobId: 'meal-timing-insights-user-1-2026-03-16' }),
    );

    jest.useRealTimers();
  });

  it('skips users with no meal data last week', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-23T01:30:00Z'));

    const queue = { add: jest.fn().mockResolvedValue({}) };
    const prisma = {
      notificationPreference: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { userId: 'user-1', reminderTimezone: 'Asia/Ulaanbaatar', channels: ['push'] },
          ]),
      },
      mealLog: { findMany: jest.fn().mockResolvedValue([]) }, // no data
      profile: { findUnique: jest.fn().mockResolvedValue(null) },
      telegramLink: { findUnique: jest.fn().mockResolvedValue(null) },
      deviceToken: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MealTimingService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('redis://localhost') },
        },
        { provide: getQueueToken(QUEUE_NAMES.MEAL_TIMING_INSIGHTS), useValue: queue },
      ],
    }).compile();

    const svc = module.get<MealTimingService>(MealTimingService);
    const count = await svc.scheduleMealTimingInsights();

    expect(count).toBe(0);
    expect(queue.add).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('skips user whose local time is not Monday', async () => {
    jest.useFakeTimers();
    // Wednesday 9:30 AM Asia/Ulaanbaatar
    jest.setSystemTime(new Date('2026-03-25T01:30:00Z'));

    const queue = { add: jest.fn().mockResolvedValue({}) };
    const prisma = {
      notificationPreference: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { userId: 'user-1', reminderTimezone: 'Asia/Ulaanbaatar', channels: ['push'] },
          ]),
      },
      mealLog: { findMany: jest.fn().mockResolvedValue([]) },
      profile: { findUnique: jest.fn().mockResolvedValue(null) },
      telegramLink: { findUnique: jest.fn().mockResolvedValue(null) },
      deviceToken: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MealTimingService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('redis://localhost') },
        },
        { provide: getQueueToken(QUEUE_NAMES.MEAL_TIMING_INSIGHTS), useValue: queue },
      ],
    }).compile();

    const svc = module.get<MealTimingService>(MealTimingService);
    const count = await svc.scheduleMealTimingInsights();

    expect(count).toBe(0);
    expect(queue.add).not.toHaveBeenCalled();

    jest.useRealTimers();
  });
});
