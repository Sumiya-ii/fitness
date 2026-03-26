import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WorkoutLogsService } from './workout-logs.service';
import { PrismaService } from '../prisma';
import { calculateCaloriesBurned, getMetValue } from './met-calculator';

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

  describe('findById', () => {
    it('throws NotFoundException for unknown id', async () => {
      prisma.workoutLog.findFirst.mockResolvedValue(null);
      await expect(service.findById('user-1', 'bad-id')).rejects.toThrow(NotFoundException);
    });

    it('returns formatted entry', async () => {
      const result = await service.findById('user-1', 'uuid-1');
      expect(result.id).toBe('uuid-1');
      expect(result.loggedAt).toBe('2026-03-26T08:00:00.000Z');
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
});
