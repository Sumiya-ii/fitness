import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { PrismaService } from '../prisma';

const mockPrisma = {
  profile: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  target: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
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

    it('should throw if onboarding already completed', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: 'user-1',
        onboardingCompletedAt: new Date(),
      });
      await expect(service.completeOnboarding('user-1', validDto)).rejects.toThrow(
        'Onboarding already completed',
      );
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
  });

  describe('getOnboardingStatus', () => {
    it('should return completed false when not done', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        onboardingCompletedAt: null,
      });
      const result = await service.getOnboardingStatus('user-1');
      expect(result.completed).toBe(false);
    });

    it('should return completed true when done', async () => {
      const date = new Date();
      mockPrisma.profile.findUnique.mockResolvedValue({
        onboardingCompletedAt: date,
      });
      const result = await service.getOnboardingStatus('user-1');
      expect(result.completed).toBe(true);
      expect(result.completedAt).toBe(date.toISOString());
    });
  });
});
