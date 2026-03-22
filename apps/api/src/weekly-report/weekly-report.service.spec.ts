import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { DateTime } from 'luxon';
import { QUEUE_NAMES } from '@coach/shared';
import { WeeklyReportService } from './weekly-report.service';
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

function makeMealLog(date: string, calories: number, protein: number) {
  return {
    loggedAt: new Date(`${date}T12:00:00Z`),
    totalCalories: calories,
    totalProtein: protein,
  };
}

describe('WeeklyReportService.buildReport', () => {
  let service: WeeklyReportService;

  beforeEach(async () => {
    const weeklyReportQueue = { add: jest.fn().mockResolvedValue({}) };
    const prisma = {
      notificationPreference: { findMany: jest.fn().mockResolvedValue([]) },
      mealLog: { findMany: jest.fn().mockResolvedValue([]) },
      weightLog: { findMany: jest.fn().mockResolvedValue([]) },
      profile: { findUnique: jest.fn().mockResolvedValue(null) },
      target: { findFirst: jest.fn().mockResolvedValue(null) },
      telegramLink: { findUnique: jest.fn().mockResolvedValue(null) },
      deviceToken: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeeklyReportService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('redis://localhost') },
        },
        { provide: getQueueToken(QUEUE_NAMES.WEEKLY_REPORT), useValue: weeklyReportQueue },
      ],
    }).compile();

    service = module.get<WeeklyReportService>(WeeklyReportService);
  });

  afterEach(() => {
    const Redis = require('ioredis');
    const instance = new Redis();
    instance._reset?.();
  });

  const lastMonday = DateTime.fromISO('2026-03-16', { zone: 'Asia/Ulaanbaatar' }); // Mon

  it('returns zeroed report when no meal or weight logs', () => {
    const report = service.buildReport([], [], null, null, 'Asia/Ulaanbaatar', lastMonday);

    expect(report.weekStart).toBe('2026-03-16');
    expect(report.weekEnd).toBe('2026-03-22');
    expect(report.daysLogged).toBe(0);
    expect(report.averageCalories).toBe(0);
    expect(report.averageProtein).toBe(0);
    expect(report.adherenceScore).toBe(0);
    expect(report.weightDelta).toBeNull();
    expect(report.endOfWeekStreak).toBe(0);
  });

  it('computes averages and adherence for 5 logged days', () => {
    const logs = [
      makeMealLog('2026-03-16', 2000, 120), // Mon
      makeMealLog('2026-03-17', 1800, 100), // Tue
      makeMealLog('2026-03-18', 2200, 140), // Wed
      makeMealLog('2026-03-19', 1900, 110), // Thu
      makeMealLog('2026-03-20', 2100, 130), // Fri
    ];

    const report = service.buildReport(logs, [], null, null, 'UTC', lastMonday);

    expect(report.daysLogged).toBe(5);
    expect(report.averageCalories).toBe(2000); // (2000+1800+2200+1900+2100)/5
    expect(report.averageProtein).toBe(120); // (120+100+140+110+130)/5
    expect(report.adherenceScore).toBeCloseTo(71.4, 1); // 5/7*100
  });

  it('aggregates multiple meal logs on the same day', () => {
    const logs = [
      { loggedAt: new Date('2026-03-16T08:00:00Z'), totalCalories: 500, totalProtein: 30 },
      { loggedAt: new Date('2026-03-16T13:00:00Z'), totalCalories: 700, totalProtein: 40 },
      { loggedAt: new Date('2026-03-16T19:00:00Z'), totalCalories: 600, totalProtein: 35 },
    ];

    const report = service.buildReport(logs, [], null, null, 'UTC', lastMonday);

    expect(report.daysLogged).toBe(1);
    expect(report.averageCalories).toBe(1800);
    expect(report.averageProtein).toBe(105);
  });

  it('computes weight delta from first to last log', () => {
    const weightLogs = [
      { weightKg: 82.0, loggedAt: new Date('2026-03-16') },
      { weightKg: 81.5, loggedAt: new Date('2026-03-19') },
      { weightKg: 81.2, loggedAt: new Date('2026-03-22') },
    ];

    const report = service.buildReport([], weightLogs, null, null, 'UTC', lastMonday);

    expect(report.weightDelta).toBe(-0.8);
  });

  it('returns null weightDelta with fewer than 2 weight logs', () => {
    const report = service.buildReport(
      [],
      [{ weightKg: 80.0, loggedAt: new Date('2026-03-16') }],
      null,
      null,
      'UTC',
      lastMonday,
    );

    expect(report.weightDelta).toBeNull();
  });

  it('computes endOfWeekStreak from Sunday backwards', () => {
    // Thu, Fri, Sat, Sun logged — streak from Sun back = 4
    const logs = [
      makeMealLog('2026-03-19', 2000, 100), // Thu
      makeMealLog('2026-03-20', 2000, 100), // Fri
      makeMealLog('2026-03-21', 2000, 100), // Sat
      makeMealLog('2026-03-22', 2000, 100), // Sun
    ];

    const report = service.buildReport(logs, [], null, null, 'UTC', lastMonday);

    expect(report.endOfWeekStreak).toBe(4);
  });

  it('breaks endOfWeekStreak at first missing day', () => {
    // Mon, Tue, Wed logged but Sat, Sun missing — streak from Sun = 0
    const logs = [
      makeMealLog('2026-03-16', 2000, 100), // Mon
      makeMealLog('2026-03-17', 2000, 100), // Tue
      makeMealLog('2026-03-18', 2000, 100), // Wed
    ];

    const report = service.buildReport(logs, [], null, null, 'UTC', lastMonday);

    expect(report.endOfWeekStreak).toBe(0);
  });

  it('passes calorieTarget and proteinTarget through to report', () => {
    const report = service.buildReport([], [], 2200, 150, 'UTC', lastMonday);

    expect(report.calorieTarget).toBe(2200);
    expect(report.proteinTarget).toBe(150);
  });
});

describe('WeeklyReportService.scheduleWeeklyReports', () => {
  it('enqueues job for user whose local time is Monday 9:30 AM', async () => {
    jest.useFakeTimers();
    // Monday 9:30 AM Asia/Ulaanbaatar = 01:30 UTC on Monday
    jest.setSystemTime(new Date('2026-03-23T01:30:00Z'));

    const weeklyReportQueue = { add: jest.fn().mockResolvedValue({}) };
    const prisma = {
      notificationPreference: {
        findMany: jest.fn().mockResolvedValue([
          {
            userId: 'user-1',
            reminderTimezone: 'Asia/Ulaanbaatar',
            channels: ['push'],
          },
        ]),
      },
      mealLog: { findMany: jest.fn().mockResolvedValue([]) },
      weightLog: { findMany: jest.fn().mockResolvedValue([]) },
      profile: { findUnique: jest.fn().mockResolvedValue({ locale: 'mn', displayName: 'Bat' }) },
      target: { findFirst: jest.fn().mockResolvedValue(null) },
      telegramLink: { findUnique: jest.fn().mockResolvedValue(null) },
      deviceToken: { findMany: jest.fn().mockResolvedValue([{ token: 'expo-tok' }]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeeklyReportService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('redis://localhost') },
        },
        { provide: getQueueToken(QUEUE_NAMES.WEEKLY_REPORT), useValue: weeklyReportQueue },
      ],
    }).compile();

    const service = module.get<WeeklyReportService>(WeeklyReportService);
    const count = await service.scheduleWeeklyReports();

    expect(count).toBe(1);
    expect(weeklyReportQueue.add).toHaveBeenCalledWith(
      'weekly_report',
      expect.objectContaining({
        userId: 'user-1',
        userName: 'Bat',
        channels: ['push'],
        pushTokens: ['expo-tok'],
        report: expect.objectContaining({ weekStart: '2026-03-16' }),
      }),
      expect.objectContaining({ jobId: 'weekly-report-user-1-2026-03-16' }),
    );

    jest.useRealTimers();
  });

  it('skips user whose local time is not Monday', async () => {
    jest.useFakeTimers();
    // Wednesday 9:30 AM Asia/Ulaanbaatar
    jest.setSystemTime(new Date('2026-03-25T01:30:00Z'));

    const weeklyReportQueue = { add: jest.fn().mockResolvedValue({}) };
    const prisma = {
      notificationPreference: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { userId: 'user-1', reminderTimezone: 'Asia/Ulaanbaatar', channels: ['push'] },
          ]),
      },
      mealLog: { findMany: jest.fn().mockResolvedValue([]) },
      weightLog: { findMany: jest.fn().mockResolvedValue([]) },
      profile: { findUnique: jest.fn().mockResolvedValue(null) },
      target: { findFirst: jest.fn().mockResolvedValue(null) },
      telegramLink: { findUnique: jest.fn().mockResolvedValue(null) },
      deviceToken: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeeklyReportService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('redis://localhost') },
        },
        { provide: getQueueToken(QUEUE_NAMES.WEEKLY_REPORT), useValue: weeklyReportQueue },
      ],
    }).compile();

    const service = module.get<WeeklyReportService>(WeeklyReportService);
    const count = await service.scheduleWeeklyReports();

    expect(count).toBe(0);
    expect(weeklyReportQueue.add).not.toHaveBeenCalled();

    jest.useRealTimers();
  });
});
