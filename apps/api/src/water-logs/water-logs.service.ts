import { Injectable } from '@nestjs/common';
import { dayBoundariesUTC } from '@coach/shared';
import { PrismaService } from '../prisma';
import { AddWaterDto } from './water-logs.dto';

export const DEFAULT_WATER_TARGET_ML = 2000;

@Injectable()
export class WaterLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async add(userId: string, dto: AddWaterDto) {
    const loggedAt = dto.loggedAt ? new Date(dto.loggedAt) : new Date();

    const entry = await this.prisma.waterLog.create({
      data: { userId, amountMl: dto.amountMl, loggedAt },
    });

    return {
      id: entry.id,
      amountMl: entry.amountMl,
      loggedAt: entry.loggedAt.toISOString(),
    };
  }

  async getDaily(userId: string, dateStr?: string) {
    const dateKey = dateStr ?? new Date().toISOString().split('T')[0]!;
    // Explicit UTC boundaries to avoid server-timezone day-boundary drift
    const { dayStart, dayEnd } = dayBoundariesUTC(dateKey);

    const [entries, profile] = await Promise.all([
      this.prisma.waterLog.findMany({
        where: { userId, loggedAt: { gte: dayStart, lt: dayEnd } },
        orderBy: { loggedAt: 'asc' },
      }),
      this.prisma.profile.findUnique({
        where: { userId },
        select: { waterTargetMl: true },
      }),
    ]);

    const consumed = entries.reduce((sum, e) => sum + e.amountMl, 0);
    const target = profile?.waterTargetMl ?? DEFAULT_WATER_TARGET_ML;

    return {
      consumed,
      target,
      entries: entries.map((e) => ({
        id: e.id,
        amountMl: e.amountMl,
        loggedAt: e.loggedAt.toISOString(),
      })),
    };
  }

  async deleteLast(userId: string) {
    const todayKey = new Date().toISOString().split('T')[0]!;
    const { dayStart, dayEnd } = dayBoundariesUTC(todayKey);

    const last = await this.prisma.waterLog.findFirst({
      where: { userId, loggedAt: { gte: dayStart, lt: dayEnd } },
      orderBy: { loggedAt: 'desc' },
    });

    if (!last) return { deleted: false };

    await this.prisma.waterLog.delete({ where: { id: last.id } });
    return { deleted: true };
  }
}
