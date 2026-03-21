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
