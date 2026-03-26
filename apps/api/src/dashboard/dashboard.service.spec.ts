import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  const mockTarget = {
    calorieTarget: 2500,
    proteinGrams: 150,
    carbsGrams: 280,
    fatGrams: 70,
  };

  beforeEach(() => {
    prisma = {
      mealLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      target: {
        findFirst: jest.fn().mockResolvedValue(mockTarget),
      },
      waterLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      profile: {
        findUnique: jest.fn().mockResolvedValue({ waterTargetMl: 2000 }),
      },
      workoutLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    service = new DashboardService(prisma as unknown as PrismaService);
  });

  it('should return zero consumed with no meals', async () => {
    const result = await service.getDailyDashboard('user-uuid', '2026-03-04');
    expect(result.consumed.calories).toBe(0);
    expect(result.remaining?.calories).toBe(2500);
    expect(result.mealCount).toBe(0);
  });

  it('should sum meal log totals', async () => {
    prisma.mealLog.findMany.mockResolvedValue([
      {
        id: '1',
        mealType: 'lunch',
        source: 'text',
        loggedAt: new Date('2026-03-04T12:00:00Z'),
        totalCalories: 500,
        totalProtein: 30,
        totalCarbs: 60,
        totalFat: 15,
        totalFiber: null,
        totalSugar: null,
        totalSodium: null,
        totalSaturatedFat: null,
        items: [],
      },
      {
        id: '2',
        mealType: 'dinner',
        source: 'text',
        loggedAt: new Date('2026-03-04T18:00:00Z'),
        totalCalories: 800,
        totalProtein: 50,
        totalCarbs: 80,
        totalFat: 25,
        totalFiber: null,
        totalSugar: null,
        totalSodium: null,
        totalSaturatedFat: null,
        items: [],
      },
    ]);

    const result = await service.getDailyDashboard('user-uuid');
    expect(result.consumed.calories).toBe(1300);
    expect(result.consumed.protein).toBe(80);
    expect(result.remaining?.calories).toBe(1200);
    expect(result.mealCount).toBe(2);
  });

  it('should calculate protein progress percentage', async () => {
    prisma.mealLog.findMany.mockResolvedValue([
      {
        id: '1',
        mealType: 'lunch',
        source: 'text',
        loggedAt: new Date('2026-03-04T12:00:00Z'),
        totalCalories: 500,
        totalProtein: 75,
        totalCarbs: 50,
        totalFat: 15,
        totalFiber: null,
        totalSugar: null,
        totalSodium: null,
        totalSaturatedFat: null,
        items: [],
      },
    ]);

    const result = await service.getDailyDashboard('user-uuid');
    expect(result.proteinProgress?.current).toBe(75);
    expect(result.proteinProgress?.target).toBe(150);
    expect(result.proteinProgress?.percentage).toBe(50);
  });

  it('should return null targets/remaining when no target set', async () => {
    prisma.target.findFirst.mockResolvedValue(null);
    const result = await service.getDailyDashboard('user-uuid');
    expect(result.targets).toBeNull();
    expect(result.remaining).toBeNull();
    expect(result.proteinProgress).toBeNull();
  });
});

describe('DashboardService.getHistory', () => {
  let service: DashboardService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  const mockTarget = {
    calorieTarget: 2000,
    proteinGrams: 150,
    carbsGrams: 250,
    fatGrams: 65,
    effectiveTo: null,
    effectiveFrom: new Date('2026-01-01'),
  };

  beforeEach(() => {
    prisma = {
      mealLog: { findMany: jest.fn().mockResolvedValue([]) },
      target: { findFirst: jest.fn().mockResolvedValue(mockTarget) },
      waterLog: { findMany: jest.fn().mockResolvedValue([]) },
      profile: { findUnique: jest.fn().mockResolvedValue({ waterTargetMl: 2000 }) },
    };
    service = new DashboardService(prisma as unknown as PrismaService);
  });

  it('returns exactly `days` entries, one per day', async () => {
    const result = await service.getHistory('user-uuid', 7);
    expect(result.history).toHaveLength(7);
  });

  it('returns 30 entries for 30-day request', async () => {
    const result = await service.getHistory('user-uuid', 30);
    expect(result.history).toHaveLength(30);
  });

  it('fills days with zero when no logs exist', async () => {
    const result = await service.getHistory('user-uuid', 7);
    for (const day of result.history) {
      expect(day.calories).toBe(0);
      expect(day.protein).toBe(0);
      expect(day.waterMl).toBe(0);
    }
  });

  it('aggregates meal logs into correct day buckets', async () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    prisma.mealLog.findMany.mockResolvedValue([
      {
        loggedAt: today,
        totalCalories: 1800,
        totalProtein: 120,
        totalCarbs: 200,
        totalFat: 60,
        totalFiber: null,
      },
      {
        loggedAt: today,
        totalCalories: 400,
        totalProtein: 30,
        totalCarbs: 50,
        totalFat: 10,
        totalFiber: null,
      },
      {
        loggedAt: yesterday,
        totalCalories: 2000,
        totalProtein: 150,
        totalCarbs: 220,
        totalFat: 70,
        totalFiber: null,
      },
    ]);

    const result = await service.getHistory('user-uuid', 7);
    const todayKey = today.toISOString().split('T')[0]!;
    const yesterdayKey = yesterday.toISOString().split('T')[0]!;

    const todayEntry = result.history.find((d) => d.date === todayKey);
    const yesterdayEntry = result.history.find((d) => d.date === yesterdayKey);

    expect(todayEntry?.calories).toBe(2200);
    expect(todayEntry?.protein).toBe(150);
    expect(yesterdayEntry?.calories).toBe(2000);
  });

  it('aggregates water logs into correct day buckets', async () => {
    const today = new Date();
    today.setHours(10, 0, 0, 0);
    prisma.waterLog.findMany.mockResolvedValue([
      { loggedAt: today, amountMl: 500 },
      { loggedAt: today, amountMl: 250 },
      { loggedAt: today, amountMl: 750 },
    ]);

    const result = await service.getHistory('user-uuid', 7);
    const todayKey = today.toISOString().split('T')[0]!;
    const todayEntry = result.history.find((d) => d.date === todayKey);

    expect(todayEntry?.waterMl).toBe(1500);
  });

  it('returns target when one exists', async () => {
    const result = await service.getHistory('user-uuid', 7);
    expect(result.target).toEqual({
      calories: 2000,
      protein: 150,
      carbs: 250,
      fat: 65,
    });
  });

  it('returns null target when none set', async () => {
    prisma.target.findFirst.mockResolvedValue(null);
    const result = await service.getHistory('user-uuid', 7);
    expect(result.target).toBeNull();
  });

  it('rounds calories and protein to correct precision', async () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    prisma.mealLog.findMany.mockResolvedValue([
      {
        loggedAt: today,
        totalCalories: 333,
        totalProtein: 33.333,
        totalCarbs: 44.444,
        totalFat: 11.111,
        totalFiber: null,
      },
    ]);

    const result = await service.getHistory('user-uuid', 7);
    const todayKey = today.toISOString().split('T')[0]!;
    const entry = result.history.find((d) => d.date === todayKey)!;

    expect(entry.calories).toBe(333); // already int
    expect(entry.protein).toBe(33.3);
    expect(entry.carbs).toBe(44.4);
    expect(entry.fat).toBe(11.1);
  });
});
