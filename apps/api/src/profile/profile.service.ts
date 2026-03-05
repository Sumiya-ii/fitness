import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { UpdateProfileDto } from './profile.dto';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return this.formatProfile(profile);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const profile = await this.prisma.profile.update({
      where: { userId },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.locale !== undefined && { locale: dto.locale }),
        ...(dto.unitSystem !== undefined && { unitSystem: dto.unitSystem }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.birthDate !== undefined && { birthDate: new Date(dto.birthDate) }),
        ...(dto.heightCm !== undefined && { heightCm: dto.heightCm }),
        ...(dto.weightKg !== undefined && { weightKg: dto.weightKg }),
        ...(dto.goalWeightKg !== undefined && { goalWeightKg: dto.goalWeightKg }),
        ...(dto.activityLevel !== undefined && { activityLevel: dto.activityLevel }),
        ...(dto.dietPreference !== undefined && { dietPreference: dto.dietPreference }),
      },
    });

    return this.formatProfile(profile);
  }

  private formatProfile(profile: {
    id: string;
    userId: string;
    displayName: string | null;
    locale: string;
    unitSystem: string;
    gender: string | null;
    birthDate: Date | null;
    heightCm: unknown;
    weightKg: unknown;
    goalWeightKg: unknown;
    activityLevel: string | null;
    dietPreference: string | null;
    onboardingCompletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      locale: profile.locale,
      unitSystem: profile.unitSystem,
      gender: profile.gender,
      birthDate: profile.birthDate?.toISOString().split('T')[0] ?? null,
      heightCm: profile.heightCm ? Number(profile.heightCm) : null,
      weightKg: profile.weightKg ? Number(profile.weightKg) : null,
      goalWeightKg: profile.goalWeightKg ? Number(profile.goalWeightKg) : null,
      activityLevel: profile.activityLevel,
      dietPreference: profile.dietPreference,
      onboardingCompletedAt: profile.onboardingCompletedAt?.toISOString() ?? null,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }
}
