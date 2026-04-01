import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { UpdateProfileDto } from './profile.dto';
import { calculateBmi } from './bmi';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const [profile, latestWeightLog] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { userId },
      }),
      this.prisma.weightLog.findFirst({
        where: { userId },
        orderBy: { loggedAt: 'desc' },
      }),
    ]);

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return this.formatProfile(profile, latestWeightLog ? Number(latestWeightLog.weightKg) : null);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const [profile, latestWeightLog] = await Promise.all([
      this.prisma.profile.update({
        where: { userId },
        data: {
          ...(dto.displayName !== undefined && { displayName: dto.displayName }),
          ...(dto.locale !== undefined && { locale: dto.locale }),
          ...(dto.timezone !== undefined && { timezone: dto.timezone }),
          ...(dto.unitSystem !== undefined && { unitSystem: dto.unitSystem }),
          ...(dto.gender !== undefined && { gender: dto.gender }),
          ...(dto.birthDate !== undefined && { birthDate: new Date(dto.birthDate) }),
          ...(dto.heightCm !== undefined && { heightCm: dto.heightCm }),
          ...(dto.weightKg !== undefined && { weightKg: dto.weightKg }),
          ...(dto.goalWeightKg !== undefined && { goalWeightKg: dto.goalWeightKg }),
          ...(dto.activityLevel !== undefined && { activityLevel: dto.activityLevel }),
          ...(dto.dietPreference !== undefined && { dietPreference: dto.dietPreference }),
        },
      }),
      this.prisma.weightLog.findFirst({
        where: { userId },
        orderBy: { loggedAt: 'desc' },
      }),
    ]);

    // Keep NotificationPreference.reminderTimezone in sync
    if (dto.timezone !== undefined) {
      await this.prisma.notificationPreference.updateMany({
        where: { userId },
        data: { reminderTimezone: dto.timezone },
      });
    }

    return this.formatProfile(profile, latestWeightLog ? Number(latestWeightLog.weightKg) : null);
  }

  private formatProfile(
    profile: {
      id: string;
      userId: string;
      displayName: string | null;
      locale: string;
      timezone: string;
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
    },
    latestWeightKg: number | null = null,
  ) {
    const heightCm = profile.heightCm ? Number(profile.heightCm) : null;
    const profileWeightKg = profile.weightKg ? Number(profile.weightKg) : null;
    const effectiveWeightKg = latestWeightKg ?? profileWeightKg;

    return {
      id: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      locale: profile.locale,
      timezone: profile.timezone,
      unitSystem: profile.unitSystem,
      gender: profile.gender,
      birthDate: profile.birthDate?.toISOString().split('T')[0] ?? null,
      heightCm,
      weightKg: profileWeightKg,
      goalWeightKg: profile.goalWeightKg ? Number(profile.goalWeightKg) : null,
      bmi: calculateBmi(heightCm, effectiveWeightKg),
      activityLevel: profile.activityLevel,
      dietPreference: profile.dietPreference,
      onboardingCompletedAt: profile.onboardingCompletedAt?.toISOString() ?? null,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }
}
