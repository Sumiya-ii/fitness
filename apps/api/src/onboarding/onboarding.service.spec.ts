import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { PrismaService } from '../prisma';
import { CoachMemoryService } from '../coach-memory/coach-memory.service';

const mockPrisma = {
  profile: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  target: {
    create: jest.fn(),
    updateMany: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
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
  });

  describe('completeOnboarding', () => {
    it('should throw if profile not found', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue(null);
      await expect(service.completeOnboarding('user-1', validDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow re-onboarding when already completed', async () => {
      const existingDate = new Date('2025-01-01');
      mockPrisma.profile.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: 'user-1',
        onboardingCompletedAt: existingDate,
        locale: 'mn',
      });
      mockPrisma.target.updateMany.mockResolvedValue({ count: 1 });

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
        id: 't-2',
        goalType: 'lose_fat',
        calorieTarget: 2100,
        proteinGrams: 170,
        carbsGrams: 200,
        fatGrams: 60,
        weeklyRateKg: 0.5,
      };

      mockPrisma.$transaction.mockResolvedValue([mockProfile, mockTarget]);

      const result = await service.completeOnboarding('user-1', validDto);

      // Should deactivate old targets before creating new one
      expect(mockPrisma.target.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', effectiveTo: null },
        data: { effectiveTo: expect.any(Date) },
      });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.target.goalType).toBe('lose_fat');
    });

    it('should create profile and target in a transaction', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: 'user-1',
        onboardingCompletedAt: null,
      });

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

      mockPrisma.$transaction.mockResolvedValue([mockProfile, mockTarget]);

      const result = await service.completeOnboarding('user-1', validDto);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.profile.gender).toBe('male');
      expect(result.target.goalType).toBe('lose_fat');
    });

    it('should schedule a delayed memory refresh after successful onboarding', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: 'user-1',
        onboardingCompletedAt: null,
        locale: 'mn',
      });
      mockPrisma.$transaction.mockResolvedValue([
        {
          id: 'p-1',
          gender: 'male',
          birthDate: new Date(),
          heightCm: 175,
          weightKg: 85,
          goalWeightKg: 70,
          activityLevel: 'moderately_active',
          dietPreference: 'standard',
        },
        {
          id: 't-1',
          goalType: 'lose_fat',
          calorieTarget: 2100,
          proteinGrams: 170,
          carbsGrams: 200,
          fatGrams: 60,
          weeklyRateKg: 0.5,
        },
      ]);

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
