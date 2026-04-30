import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { PrismaService } from '../prisma';
import { CoachMemoryService } from '../coach-memory/coach-memory.service';

// Build a tx-like object mirroring the real Prisma interactive transaction client.
function makeTx() {
  return {
    profile: { update: jest.fn() },
    target: { updateMany: jest.fn(), create: jest.fn() },
  };
}

const mockTx = makeTx();

const mockPrisma = {
  profile: {
    findUnique: jest.fn(),
  },
  target: {
    findFirst: jest.fn(),
  },
  // Executes the callback with the mock tx immediately.
  $transaction: jest
    .fn()
    .mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
};

const mockCoachMemory: Pick<CoachMemoryService, 'enqueueForUser'> = {
  enqueueForUser: jest.fn().mockResolvedValue(undefined),
};

const validDto = {
  goalType: 'lose_fat' as const,
  goalWeightKg: 70,
  weeklyRateKg: 0.5,
  gender: 'male' as const,
  birthDate: '1995-06-15',
  heightCm: 175,
  weightKg: 85,
  activityLevel: 'moderately_active' as const,
  dietPreference: 'standard' as const,
};

const mockProfile = {
  id: 'p-1',
  gender: 'male',
  birthDate: new Date('1995-06-15'),
  heightCm: 175,
  weightKg: 85,
  goalWeightKg: 70,
  activityLevel: 'moderately_active',
  dietPreference: 'standard',
};

const mockTarget = {
  id: 't-1',
  goalType: 'lose_fat',
  calorieTarget: 2100,
  proteinGrams: 170,
  carbsGrams: 200,
  fatGrams: 60,
  weeklyRateKg: 0.5,
};

describe('OnboardingService', () => {
  let service: OnboardingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CoachMemoryService, useValue: mockCoachMemory },
      ],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);
    jest.clearAllMocks();

    // Default: tx writes succeed
    mockTx.profile.update.mockResolvedValue(mockProfile);
    mockTx.target.create.mockResolvedValue(mockTarget);
    mockTx.target.updateMany.mockResolvedValue({ count: 0 });

    // Re-wire $transaction to use fresh mockTx after clearAllMocks
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
    );
  });

  describe('completeOnboarding', () => {
    it('should throw if profile not found', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue(null);
      await expect(service.completeOnboarding('user-1', validDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create profile and target inside a single transaction', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: 'user-1',
        onboardingCompletedAt: null,
        locale: 'mn',
      });

      const result = await service.completeOnboarding('user-1', validDto);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.profile.update).toHaveBeenCalled();
      expect(mockTx.target.create).toHaveBeenCalled();
      expect(result.profile.gender).toBe('male');
      expect(result.target.goalType).toBe('lose_fat');
    });

    it('should deactivate old targets inside the transaction on re-onboarding', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: 'user-1',
        onboardingCompletedAt: new Date('2025-01-01'),
        locale: 'mn',
      });

      await service.completeOnboarding('user-1', validDto);

      expect(mockTx.target.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', effectiveTo: null },
        data: { effectiveTo: expect.any(Date) },
      });
    });

    it('rolls back entirely when target.create throws (no half-state)', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: 'user-1',
        onboardingCompletedAt: null,
        locale: 'mn',
      });
      mockTx.target.create.mockRejectedValue(new Error('DB error'));

      // The transaction callback throws, so $transaction propagates the error.
      // In a real DB this means the profile update is rolled back too.
      await expect(service.completeOnboarding('user-1', validDto)).rejects.toThrow('DB error');

      // profile.update was called inside the tx, but tx threw → no committed state
      expect(mockTx.profile.update).toHaveBeenCalled();
      expect(mockTx.target.create).toHaveBeenCalled();
    });

    it('should schedule a delayed memory refresh after successful onboarding', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: 'user-1',
        onboardingCompletedAt: null,
        locale: 'mn',
      });

      await service.completeOnboarding('user-1', validDto);

      expect(mockCoachMemory.enqueueForUser).toHaveBeenCalledWith(
        'user-1',
        'mn',
        7 * 24 * 60 * 60 * 1000,
      );
    });
  });

  describe('getOnboardingStatus', () => {
    it('should return completed false when profile not done', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        onboardingCompletedAt: null,
      });
      mockPrisma.target.findFirst.mockResolvedValue(null);
      const result = await service.getOnboardingStatus('user-1');
      expect(result.completed).toBe(false);
    });

    it('should return completed true when profile done and active target exists', async () => {
      const date = new Date();
      mockPrisma.profile.findUnique.mockResolvedValue({
        onboardingCompletedAt: date,
      });
      mockPrisma.target.findFirst.mockResolvedValue({ id: 't-1' });
      const result = await service.getOnboardingStatus('user-1');
      expect(result.completed).toBe(true);
      expect(result.completedAt).toBe(date.toISOString());
    });

    it('should return completed false when profile done but no active target', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        onboardingCompletedAt: new Date(),
      });
      mockPrisma.target.findFirst.mockResolvedValue(null);
      const result = await service.getOnboardingStatus('user-1');
      expect(result.completed).toBe(false);
      expect(result.completedAt).toBeNull();
    });
  });
});
