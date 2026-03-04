import { WeeklySummaryService } from './weekly-summary.service';
import { PrismaService } from '../prisma';

describe('WeeklySummaryService', () => {
  let service: WeeklySummaryService;
  let prisma: {
    mealLog: { findMany: jest.Mock };
    weightLog: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      mealLog: { findMany: jest.fn().mockResolvedValue([]) },
      weightLog: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new WeeklySummaryService(prisma as unknown as PrismaService);
  });

  it('should return empty week summary when no logs', async () => {
    const result = await service.getWeeklySummary('user-uuid', '2026-03-02');

    expect(result.weekStart).toBe('2026-03-02');
    expect(result.weekEnd).toBe('2026-03-08');
    expect(result.daysLogged).toBe(0);
    expect(result.averageCalories).toBe(0);
    expect(result.averageProtein).toBe(0);
    expect(result.averageCarbs).toBe(0);
    expect(result.averageFat).toBe(0);
    expect(result.adherenceScore).toBe(0);
    expect(result.weightStart).toBeNull();
    expect(result.weightEnd).toBeNull();
    expect(result.weightDelta).toBeNull();
  });

  it('should normalize week param to Monday (Wed 2026-03-04 -> Mon 2026-03-02)', async () => {
    prisma.mealLog.findMany.mockResolvedValue([]);

    const result = await service.getWeeklySummary('user-uuid', '2026-03-04');

    expect(result.weekStart).toBe('2026-03-02');
    expect(result.weekEnd).toBe('2026-03-08');
    expect(prisma.mealLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-uuid',
          loggedAt: expect.any(Object),
        }),
      }),
    );
  });

  it('should calculate partial week correctly', async () => {
    const monday = new Date('2026-03-02T12:00:00Z');
    const tuesday = new Date('2026-03-03T12:00:00Z');

    prisma.mealLog.findMany.mockResolvedValue([
      { loggedAt: monday, totalCalories: 2000, totalProtein: 100, totalCarbs: 200, totalFat: 60 },
      { loggedAt: tuesday, totalCalories: 1800, totalProtein: 90, totalCarbs: 180, totalFat: 50 },
    ]);

    const result = await service.getWeeklySummary('user-uuid', '2026-03-02');

    expect(result.daysLogged).toBe(2);
    expect(result.averageCalories).toBe(1900); // (2000 + 1800) / 2
    expect(result.averageProtein).toBe(95);
    expect(result.averageCarbs).toBe(190);
    expect(result.averageFat).toBe(55);
    expect(result.adherenceScore).toBeCloseTo(28.6, 1); // 2/7 * 100
  });

  it('should aggregate multiple meals per day', async () => {
    const monday = new Date('2026-03-02T08:00:00Z');
    const mondayLunch = new Date('2026-03-02T13:00:00Z');

    prisma.mealLog.findMany.mockResolvedValue([
      { loggedAt: monday, totalCalories: 500, totalProtein: 25, totalCarbs: 50, totalFat: 15 },
      { loggedAt: mondayLunch, totalCalories: 700, totalProtein: 35, totalCarbs: 70, totalFat: 20 },
    ]);

    const result = await service.getWeeklySummary('user-uuid', '2026-03-02');

    expect(result.daysLogged).toBe(1);
    expect(result.averageCalories).toBe(1200);
    expect(result.averageProtein).toBe(60);
    expect(result.averageCarbs).toBe(120);
    expect(result.averageFat).toBe(35);
  });

  it('should calculate full week averages', async () => {
    const logs = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date('2026-03-02');
      date.setDate(date.getDate() + d);
      date.setHours(12, 0, 0, 0);
      logs.push({
        loggedAt: date,
        totalCalories: 2000,
        totalProtein: 100,
        totalCarbs: 200,
        totalFat: 60,
      });
    }

    prisma.mealLog.findMany.mockResolvedValue(logs);

    const result = await service.getWeeklySummary('user-uuid', '2026-03-02');

    expect(result.daysLogged).toBe(7);
    expect(result.averageCalories).toBe(2000);
    expect(result.averageProtein).toBe(100);
    expect(result.averageCarbs).toBe(200);
    expect(result.averageFat).toBe(60);
    expect(result.adherenceScore).toBe(100);
  });

  it('should compute weight delta from start to end of week', async () => {
    prisma.mealLog.findMany.mockResolvedValue([]);
    prisma.weightLog.findMany.mockResolvedValue([
      { weightKg: 80.5, loggedAt: new Date('2026-03-02') },
      { weightKg: 80.2, loggedAt: new Date('2026-03-05') },
      { weightKg: 79.8, loggedAt: new Date('2026-03-08') },
    ]);

    const result = await service.getWeeklySummary('user-uuid', '2026-03-02');

    expect(result.weightStart).toBe(80.5);
    expect(result.weightEnd).toBe(79.8);
    expect(result.weightDelta).toBe(-0.7);
  });

  it('should return null weight fields when no weight logs', async () => {
    prisma.mealLog.findMany.mockResolvedValue([]);
    prisma.weightLog.findMany.mockResolvedValue([]);

    const result = await service.getWeeklySummary('user-uuid', '2026-03-02');

    expect(result.weightStart).toBeNull();
    expect(result.weightEnd).toBeNull();
    expect(result.weightDelta).toBeNull();
  });

  it('should use current week when week param omitted', async () => {
    prisma.mealLog.findMany.mockResolvedValue([]);

    const result = await service.getWeeklySummary('user-uuid');

    expect(result.weekStart).toBeDefined();
    expect(result.weekEnd).toBeDefined();
    const [y, m, d] = result.weekStart.split('-').map(Number);
    expect(new Date(y, m - 1, d).getDay()).toBe(1); // Monday
  });
});
