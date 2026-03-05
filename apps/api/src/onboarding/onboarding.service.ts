import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { calculateTargets } from '../targets/target-calculator';
import { CompleteOnboardingDto } from './onboarding.dto';

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async completeOnboarding(userId: string, dto: CompleteOnboardingDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new BadRequestException('Profile not found. User may not be fully registered.');
    }

    if (profile.onboardingCompletedAt) {
      throw new BadRequestException('Onboarding already completed.');
    }

    const targets = calculateTargets({
      gender: dto.gender,
      birthDate: dto.birthDate,
      heightCm: dto.heightCm,
      weightKg: dto.weightKg,
      activityLevel: dto.activityLevel,
      goalType: dto.goalType,
      weeklyRateKg: dto.weeklyRateKg,
      dietPreference: dto.dietPreference,
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [updatedProfile, target] = await this.prisma.$transaction([
      this.prisma.profile.update({
        where: { userId },
        data: {
          gender: dto.gender,
          birthDate: new Date(dto.birthDate),
          heightCm: dto.heightCm,
          weightKg: dto.weightKg,
          goalWeightKg: dto.goalWeightKg,
          activityLevel: dto.activityLevel,
          dietPreference: dto.dietPreference,
          onboardingCompletedAt: new Date(),
        },
      }),
      this.prisma.target.create({
        data: {
          userId,
          goalType: dto.goalType,
          calorieTarget: targets.calorieTarget,
          proteinGrams: targets.proteinGrams,
          carbsGrams: targets.carbsGrams,
          fatGrams: targets.fatGrams,
          weeklyRateKg: dto.weeklyRateKg,
          effectiveFrom: today,
        },
      }),
    ]);

    return {
      profile: {
        id: updatedProfile.id,
        gender: updatedProfile.gender,
        birthDate: updatedProfile.birthDate?.toISOString().split('T')[0] ?? null,
        heightCm: updatedProfile.heightCm ? Number(updatedProfile.heightCm) : null,
        weightKg: updatedProfile.weightKg ? Number(updatedProfile.weightKg) : null,
        goalWeightKg: updatedProfile.goalWeightKg
          ? Number(updatedProfile.goalWeightKg)
          : null,
        activityLevel: updatedProfile.activityLevel,
        dietPreference: updatedProfile.dietPreference,
      },
      target: {
        id: target.id,
        goalType: target.goalType,
        calorieTarget: target.calorieTarget,
        proteinGrams: target.proteinGrams,
        carbsGrams: target.carbsGrams,
        fatGrams: target.fatGrams,
        weeklyRateKg: Number(target.weeklyRateKg),
      },
    };
  }

  async getOnboardingStatus(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { onboardingCompletedAt: true },
    });

    return {
      completed: !!profile?.onboardingCompletedAt,
      completedAt: profile?.onboardingCompletedAt?.toISOString() ?? null,
    };
  }
}
