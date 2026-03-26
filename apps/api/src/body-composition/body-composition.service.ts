import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { LogMeasurementDto } from './body-composition.dto';
import {
  calculateNavyBodyFat,
  classifyBodyFat,
  calculateWeeklyBudget,
  type DailyCalorieEntry,
} from './body-composition.calculator';

@Injectable()
export class BodyCompositionService {
  constructor(private readonly prisma: PrismaService) {}

  async logMeasurement(userId: string, dto: LogMeasurementDto) {
    const [profile, latestWeight] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { userId },
        select: { gender: true, heightCm: true, weightKg: true },
      }),
      this.prisma.weightLog.findFirst({
        where: { userId },
        orderBy: { loggedAt: 'desc' },
      }),
    ]);

    if (!profile?.gender || !profile?.heightCm) {
      throw new BadRequestException(
        'Profile must have gender and height set before logging body measurements',
      );
    }

    const gender = profile.gender as 'male' | 'female';
    if (gender !== 'male' && gender !== 'female') {
      throw new BadRequestException(
        'Body fat calculation requires gender to be "male" or "female"',
      );
    }

    if (gender === 'female' && !dto.hipCm) {
      throw new BadRequestException(
        'Hip circumference is required for female body fat calculation',
      );
    }

    const effectiveWeight = latestWeight
      ? Number(latestWeight.weightKg)
      : profile.weightKg
        ? Number(profile.weightKg)
        : null;
    if (!effectiveWeight) {
      throw new BadRequestException('Weight is required. Please log your weight first.');
    }

    const heightCm = Number(profile.heightCm);

    const result = calculateNavyBodyFat({
      gender,
      heightCm,
      waistCm: dto.waistCm,
      neckCm: dto.neckCm,
      hipCm: dto.hipCm,
      weightKg: effectiveWeight,
    });

    if (!result) {
      throw new BadRequestException(
        'Could not calculate body fat. Please check your measurements.',
      );
    }

    const date = dto.loggedAt ? new Date(dto.loggedAt) : new Date();
    date.setHours(0, 0, 0, 0);

    const entry = await this.prisma.bodyMeasurementLog.upsert({
      where: {
        userId_loggedAt: { userId, loggedAt: date },
      },
      update: {
        waistCm: dto.waistCm,
        neckCm: dto.neckCm,
        hipCm: dto.hipCm ?? null,
        weightKg: effectiveWeight,
        bodyFatPercent: result.bodyFatPercent,
        fatMassKg: result.fatMassKg,
        leanMassKg: result.leanMassKg,
        bmi: result.bmi.standard,
        bmiCategory: result.bmi.category,
      },
      create: {
        userId,
        waistCm: dto.waistCm,
        neckCm: dto.neckCm,
        hipCm: dto.hipCm ?? null,
        weightKg: effectiveWeight,
        bodyFatPercent: result.bodyFatPercent,
        fatMassKg: result.fatMassKg,
        leanMassKg: result.leanMassKg,
        bmi: result.bmi.standard,
        bmiCategory: result.bmi.category,
        loggedAt: date,
      },
    });

    return this.formatEntry(entry, gender);
  }

  async getLatest(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { gender: true, heightCm: true, weightKg: true },
    });

    const entry = await this.prisma.bodyMeasurementLog.findFirst({
      where: { userId },
      orderBy: { loggedAt: 'desc' },
    });

    if (!entry) return null;

    const gender = (profile?.gender as 'male' | 'female') ?? 'male';
    return this.formatEntry(entry, gender);
  }

  async getHistory(userId: string, days = 90) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { gender: true },
    });

    const logs = await this.prisma.bodyMeasurementLog.findMany({
      where: { userId, loggedAt: { gte: since } },
      orderBy: { loggedAt: 'asc' },
    });

    const gender = (profile?.gender as 'male' | 'female') ?? 'male';
    return logs.map((l) => this.formatEntry(l, gender));
  }

  async getWeeklyBudget(userId: string) {
    const target = await this.prisma.target.findFirst({
      where: { userId, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!target) return null;

    const today = new Date().toISOString().split('T')[0]!;
    const todayDate = new Date(today + 'T12:00:00Z');
    const dayOfWeek = (todayDate.getUTCDay() + 6) % 7;
    const mondayDate = new Date(todayDate);
    mondayDate.setUTCDate(todayDate.getUTCDate() - dayOfWeek);

    const sundayDate = new Date(mondayDate);
    sundayDate.setUTCDate(mondayDate.getUTCDate() + 6);

    const dayStart = new Date(mondayDate.toISOString().split('T')[0] + 'T00:00:00.000Z');
    const dayEnd = new Date(sundayDate.toISOString().split('T')[0] + 'T23:59:59.999Z');

    const mealLogs = await this.prisma.mealLog.findMany({
      where: {
        userId,
        loggedAt: { gte: dayStart, lte: dayEnd },
      },
      select: {
        loggedAt: true,
        totalCalories: true,
      },
    });

    // Aggregate by date
    const byDate = new Map<string, number>();
    for (const log of mealLogs) {
      const dateKey = log.loggedAt.toISOString().split('T')[0]!;
      byDate.set(dateKey, (byDate.get(dateKey) ?? 0) + (log.totalCalories ?? 0));
    }

    const entries: DailyCalorieEntry[] = Array.from(byDate.entries()).map(([date, consumed]) => ({
      date,
      consumed,
    }));

    return calculateWeeklyBudget(target.calorieTarget, entries, today);
  }

  private formatEntry(
    entry: {
      id: string;
      waistCm: unknown;
      neckCm: unknown;
      hipCm: unknown;
      weightKg: unknown;
      bodyFatPercent: unknown;
      fatMassKg: unknown;
      leanMassKg: unknown;
      bmi: unknown;
      bmiCategory: string;
      loggedAt: Date;
    },
    gender: 'male' | 'female',
  ) {
    const bodyFatPercent = Number(entry.bodyFatPercent);
    return {
      id: entry.id,
      waistCm: Number(entry.waistCm),
      neckCm: Number(entry.neckCm),
      hipCm: entry.hipCm ? Number(entry.hipCm) : null,
      weightKg: Number(entry.weightKg),
      bodyFatPercent,
      fatMassKg: Number(entry.fatMassKg),
      leanMassKg: Number(entry.leanMassKg),
      bmi: Number(entry.bmi),
      bmiCategory: entry.bmiCategory,
      bodyFatCategory: classifyBodyFat(bodyFatPercent, gender),
      loggedAt: entry.loggedAt.toISOString().split('T')[0],
    };
  }
}
