import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { AddWaterDto } from './water-logs.dto';

export const WATER_TARGET_ML = 2000;

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
    const date = dateStr ? new Date(dateStr) : new Date();
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const entries = await this.prisma.waterLog.findMany({
      where: { userId, loggedAt: { gte: dayStart, lt: dayEnd } },
      orderBy: { loggedAt: 'asc' },
    });

    const consumed = entries.reduce((sum, e) => sum + e.amountMl, 0);

    return {
      consumed,
      target: WATER_TARGET_ML,
      entries: entries.map((e) => ({
        id: e.id,
        amountMl: e.amountMl,
        loggedAt: e.loggedAt.toISOString(),
      })),
    };
  }

  async deleteLast(userId: string) {
    const today = new Date();
    const dayStart = new Date(today);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const last = await this.prisma.waterLog.findFirst({
      where: { userId, loggedAt: { gte: dayStart, lt: dayEnd } },
      orderBy: { loggedAt: 'desc' },
    });

    if (!last) return { deleted: false };

    await this.prisma.waterLog.delete({ where: { id: last.id } });
    return { deleted: true };
  }
}
