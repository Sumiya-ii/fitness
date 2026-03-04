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
        ...(dto.activityLevel !== undefined && { activityLevel: dto.activityLevel }),
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
    activityLevel: string | null;
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
      activityLevel: profile.activityLevel,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }
}
