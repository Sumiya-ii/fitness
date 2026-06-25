import { BadRequestException } from '@nestjs/common';
import { TargetsService } from './targets.service';
import { PrismaService } from '../prisma';
import { ProfileService } from '../profile';

jest.mock('./target-calculator', () => ({
  calculateTargets: jest.fn().mockReturnValue({
    calorieTarget: 2000,
    proteinGrams: 150,
    carbsGrams: 200,
    fatGrams: 65,
  }),
}));

describe('TargetsService', () => {
  let service: TargetsService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let profileService: Record<string, any>;

  const mockProfile = {
    gender: 'male',
    birthDate: '1995-01-01',
    heightCm: 175,
    activityLevel: 'moderate',
  };

  const mockTarget = {
    id: 'target-uuid',
    userId: 'user-uuid',
    goalType: 'lose_fat',
    calorieTarget: 2000,
    proteinGrams: 150,
    carbsGrams: 200,
    fatGrams: 65,
    weeklyRateKg: 0.5,
    effectiveFrom: new Date('2026-06-25T00:00:00.000Z'),
    effectiveTo: null,
    createdAt: new Date('2026-06-25T00:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      target: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue(mockTarget),
        findFirst: jest.fn().mockResolvedValue(mockTarget),
        findMany: jest.fn().mockResolvedValue([mockTarget]),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => {
        const tx = {
          target: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            create: jest.fn().mockResolvedValue(mockTarget),
          },
        };
        return cb(tx);
      }),
    };

    profileService = {
      getProfile: jest.fn().mockResolvedValue(mockProfile),
    };

    service = new TargetsService(
      prisma as unknown as PrismaService,
      profileService as unknown as ProfileService,
    );
  });

  describe('createTarget', () => {
    it('deactivates old target and creates new one in a transaction', async () => {
      const result = await service.createTarget('user-uuid', {
        goalType: 'lose_fat',
        weightKg: 80,
        weeklyRateKg: 0.5,
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.goalType).toBe('lose_fat');
      expect(result.calorieTarget).toBe(2000);
    });

    it('calls updateMany before create inside the transaction', async () => {
      const txUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
      const txCreate = jest.fn().mockResolvedValue(mockTarget);

      prisma.$transaction = jest.fn().mockImplementation(async (cb) => {
        return cb({ target: { updateMany: txUpdateMany, create: txCreate } });
      });

      await service.createTarget('user-uuid', {
        goalType: 'lose_fat',
        weightKg: 80,
        weeklyRateKg: 0.5,
      });

      const updateManyOrder = txUpdateMany.mock.invocationCallOrder[0];
      const createOrder = txCreate.mock.invocationCallOrder[0];
      expect(updateManyOrder).toBeLessThan(createOrder);
    });

    it('deactivates only open-ended targets for the user', async () => {
      const txUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
      const txCreate = jest.fn().mockResolvedValue(mockTarget);

      prisma.$transaction = jest.fn().mockImplementation(async (cb) => {
        return cb({ target: { updateMany: txUpdateMany, create: txCreate } });
      });

      await service.createTarget('user-uuid', {
        goalType: 'lose_fat',
        weightKg: 80,
        weeklyRateKg: 0.5,
      });

      expect(txUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-uuid', effectiveTo: null }),
        }),
      );
    });

    it('throws BadRequestException when profile is incomplete', async () => {
      profileService.getProfile.mockResolvedValue({ gender: null });

      await expect(
        service.createTarget('user-uuid', {
          goalType: 'lose_fat',
          weightKg: 80,
          weeklyRateKg: 0.5,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('returns ISO date strings for effectiveFrom and effectiveTo', async () => {
      const result = await service.createTarget('user-uuid', {
        goalType: 'lose_fat',
        weightKg: 80,
        weeklyRateKg: 0.5,
      });

      expect(result.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.effectiveTo).toBeNull();
    });
  });

  describe('getCurrentTarget', () => {
    it('returns the active target for the user', async () => {
      const result = await service.getCurrentTarget('user-uuid');

      expect(prisma.target.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-uuid', effectiveTo: null },
        }),
      );
      expect(result?.id).toBe('target-uuid');
    });

    it('returns null when no active target exists', async () => {
      prisma.target.findFirst.mockResolvedValue(null);
      const result = await service.getCurrentTarget('user-uuid');
      expect(result).toBeNull();
    });
  });

  describe('getTargetHistory', () => {
    it('returns all targets ordered by effectiveFrom desc', async () => {
      const result = await service.getTargetHistory('user-uuid');

      expect(prisma.target.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-uuid' },
          orderBy: { effectiveFrom: 'desc' },
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('target-uuid');
    });
  });
});
