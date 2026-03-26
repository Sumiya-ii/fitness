import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WorkoutLogsService } from './workout-logs.service';
import { PrismaService } from '../prisma';
import {
  calculateCaloriesBurned,
  getMetValue,
  getWorkoutTypeInfo,
  getWorkoutCatalog,
} from './met-calculator';

// ─── MET Calculator unit tests ───────────────────────────────────────────────

describe('MET calculator', () => {
  it('uses known MET for running', () => {
    expect(getMetValue('running')).toBe(9.8);
  });

  it('normalises spaces and dashes', () => {
    expect(getMetValue('weight training')).toBe(getMetValue('weight_training'));
    expect(getMetValue('weight-training')).toBe(getMetValue('weight_training'));
  });

  it('falls back to 5.0 for unknown types', () => {
    expect(getMetValue('underwater_basket_weaving')).toBe(5.0);
  });

  it('calculates calories correctly', () => {
    // running MET=9.8, 70 kg, 30 min → 9.8 × 70 × 0.5 = 343
    expect(calculateCaloriesBurned('running', 30, 70)).toBe(343);
  });

  it('returns 0 for zero duration', () => {
    expect(calculateCaloriesBurned('running', 0, 70)).toBe(0);
  });

  it('returns 0 for zero weight', () => {
    expect(calculateCaloriesBurned('running', 30, 0)).toBe(0);
  });

  it('getWorkoutTypeInfo returns label and icon for known types', () => {
    const info = getWorkoutTypeInfo('running');
    expect(info).not.toBeNull();
    expect(info!.label.mn).toBe('Гүйлт');
    expect(info!.icon).toBe('🏃');
    expect(info!.category).toBe('cardio');
  });

  it('getWorkoutTypeInfo returns null for unknown types', () => {
    expect(getWorkoutTypeInfo('flamethrowing')).toBeNull();
  });

  it('getWorkoutCatalog returns grouped categories', () => {
    const catalog = getWorkoutCatalog();
    expect(catalog.cardio).toBeDefined();
    expect(catalog.strength).toBeDefined();
    expect(catalog.sports).toBeDefined();
    expect(catalog.flexibility).toBeDefined();
    expect(catalog.cardio.length).toBeGreaterThan(0);
  });
});

// ─── WorkoutLogsService ───────────────────────────────────────────────────────

const mockEntry = {
  id: 'uuid-1',
  userId: 'user-1',
  workoutType: 'running',
  durationMin: 30,
  calorieBurned: 343,
  note: null,
  loggedAt: new Date('2026-03-26T08:00:00.000Z'),
  createdAt: new Date('2026-03-26T08:00:00.000Z'),
};

describe('WorkoutLogsService', () => {
  let service: WorkoutLogsService;
  let prisma: {
    workoutLog: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
    profile: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      workoutLog: {
        create: jest.fn().mockResolvedValue(mockEntry),
        findMany: jest.fn().mockResolvedValue([mockEntry]),
        findFirst: jest.fn().mockResolvedValue(mockEntry),
        update: jest.fn().mockResolvedValue(mockEntry),
        delete: jest.fn().mockResolvedValue(mockEntry),
        count: jest.fn().mockResolvedValue(1),
      },
      profile: {
        findUnique: jest.fn().mockResolvedValue({ weightKg: 70 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkoutLogsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(WorkoutLogsService);
  });

  describe('create', () => {
    it('calculates calorie burn from profile weight', async () => {
      const result = await service.create('user-1', {
        workoutType: 'running',
        durationMin: 30,
      });
      expect(prisma.workoutLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ calorieBurned: 343 }),
        }),
      );
      expect(result.calorieBurned).toBe(343);
    });

    it('defaults to 70 kg when profile has no weight', async () => {
      prisma.profile.findUnique.mockResolvedValue(null);
      await service.create('user-1', { workoutType: 'running', durationMin: 30 });
      expect(prisma.workoutLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ calorieBurned: 343 }),
        }),
      );
    });

    it('stores null calorie burn when duration is omitted', async () => {
      prisma.workoutLog.create.mockResolvedValue({
        ...mockEntry,
        durationMin: null,
        calorieBurned: null,
      });
      const result = await service.create('user-1', { workoutType: 'yoga' });
      expect(prisma.workoutLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ calorieBurned: null }),
        }),
      );
      expect(result.calorieBurned).toBeNull();
    });
  });

  describe('format enrichment', () => {
    it('includes label and icon for known types', async () => {
      const result = await service.findById('user-1', 'uuid-1');
      expect(result.label).toEqual({ en: 'Running', mn: 'Гүйлт' });
      expect(result.icon).toBe('🏃');
    });

    it('returns null label/icon for unknown types', async () => {
      prisma.workoutLog.findFirst.mockResolvedValue({ ...mockEntry, workoutType: 'zorbing' });
      const result = await service.findById('user-1', 'uuid-1');
      expect(result.label).toBeNull();
      expect(result.icon).toBeNull();
    });
  });

  describe('findById', () => {
    it('throws NotFoundException for unknown id', async () => {
      prisma.workoutLog.findFirst.mockResolvedValue(null);
      await expect(service.findById('user-1', 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('estimate', () => {
    it('returns calorie estimate with label', async () => {
      const result = await service.estimate('user-1', 'running', 30);
      expect(result.calorieBurned).toBe(343);
      expect(result.weightKg).toBe(70);
      expect(result.label).toEqual({ en: 'Running', mn: 'Гүйлт' });
    });
  });

  describe('getRecents', () => {
    it('returns distinct workout types with labels', async () => {
      prisma.workoutLog.findMany.mockResolvedValue([
        { workoutType: 'running', durationMin: 30, calorieBurned: 343 },
        { workoutType: 'running', durationMin: 25, calorieBurned: 286 },
        { workoutType: 'yoga', durationMin: 60, calorieBurned: 210 },
      ]);
      const recents = await service.getRecents('user-1');
      expect(recents).toHaveLength(2);
      expect(recents[0].workoutType).toBe('running');
      expect(recents[1].workoutType).toBe('yoga');
      expect(recents[0].label?.mn).toBe('Гүйлт');
    });
  });

  describe('getWeeklySummary', () => {
    it('aggregates workout stats for the week', async () => {
      prisma.workoutLog.findMany.mockResolvedValue([
        {
          workoutType: 'running',
          durationMin: 30,
          calorieBurned: 343,
          loggedAt: new Date('2026-03-26T08:00:00Z'),
        },
        {
          workoutType: 'yoga',
          durationMin: 60,
          calorieBurned: 210,
          loggedAt: new Date('2026-03-25T08:00:00Z'),
        },
      ]);
      const summary = await service.getWeeklySummary('user-1');
      expect(summary.workoutCount).toBe(2);
      expect(summary.totalDurationMin).toBe(90);
      expect(summary.totalCaloriesBurned).toBe(553);
      expect(summary.activeDays).toBe(2);
      expect(summary.byType).toEqual({ running: 1, yoga: 1 });
    });
  });

  describe('getDailyBurn', () => {
    it('sums calorieBurned across all workouts for the day', async () => {
      prisma.workoutLog.findMany.mockResolvedValue([
        { calorieBurned: 300 },
        { calorieBurned: 200 },
        { calorieBurned: null },
      ]);
      const total = await service.getDailyBurn('user-1', '2026-03-26');
      expect(total).toBe(500);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when entry does not belong to user', async () => {
      prisma.workoutLog.findFirst.mockResolvedValue(null);
      await expect(service.remove('user-1', 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTypes', () => {
    it('returns categorized catalog', () => {
      const types = service.getTypes();
      expect(types.cardio).toBeDefined();
      expect(types.strength).toBeDefined();
    });
  });
});
