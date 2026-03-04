import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { ProfileService } from '../profile';
import { calculateTargets } from './target-calculator';
import { CreateTargetDto } from './targets.dto';

@Injectable()
export class TargetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileService: ProfileService,
  ) {}

  async createTarget(userId: string, dto: CreateTargetDto) {
    const profile = await this.profileService.getProfile(userId);

    if (!profile.gender || !profile.birthDate || !profile.heightCm || !profile.activityLevel) {
      throw new BadRequestException(
        'Profile must have gender, birthDate, heightCm, and activityLevel set before creating a target.',
      );
    }

    const result = calculateTargets({
      gender: profile.gender,
      birthDate: profile.birthDate,
      heightCm: profile.heightCm,
      weightKg: dto.weightKg,
      activityLevel: profile.activityLevel,
      goalType: dto.goalType,
      weeklyRateKg: dto.weeklyRateKg,
    });

    // Deactivate previous target
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.target.updateMany({
      where: {
        userId,
        effectiveTo: null,
      },
      data: {
        effectiveTo: today,
      },
    });

    const target = await this.prisma.target.create({
      data: {
        userId,
        goalType: dto.goalType,
        calorieTarget: result.calorieTarget,
        proteinGrams: result.proteinGrams,
        carbsGrams: result.carbsGrams,
        fatGrams: result.fatGrams,
        weeklyRateKg: dto.weeklyRateKg,
        effectiveFrom: today,
      },
    });

    return this.formatTarget(target);
  }

  async getCurrentTarget(userId: string) {
    const target = await this.prisma.target.findFirst({
      where: {
        userId,
        effectiveTo: null,
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    return target ? this.formatTarget(target) : null;
  }

  async getTargetHistory(userId: string) {
    const targets = await this.prisma.target.findMany({
      where: { userId },
      orderBy: { effectiveFrom: 'desc' },
    });

    return targets.map((t) => this.formatTarget(t));
  }

  private formatTarget(target: {
    id: string;
    userId: string;
    goalType: string;
    calorieTarget: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
    weeklyRateKg: unknown;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    createdAt: Date;
  }) {
    return {
      id: target.id,
      userId: target.userId,
      goalType: target.goalType,
      calorieTarget: target.calorieTarget,
      proteinGrams: target.proteinGrams,
      carbsGrams: target.carbsGrams,
      fatGrams: target.fatGrams,
      weeklyRateKg: Number(target.weeklyRateKg),
      effectiveFrom: (target.effectiveFrom as Date).toISOString().split('T')[0],
      effectiveTo: target.effectiveTo?.toISOString().split('T')[0] ?? null,
      createdAt: target.createdAt.toISOString(),
    };
  }
}
