import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { CreateWeightLogDto } from './weight-logs.dto';

@Injectable()
export class WeightLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async log(userId: string, dto: CreateWeightLogDto) {
    const date = dto.loggedAt ? new Date(dto.loggedAt) : new Date();
    date.setHours(0, 0, 0, 0);

    const entry = await this.prisma.weightLog.upsert({
      where: {
        userId_loggedAt: { userId, loggedAt: date },
      },
      update: { weightKg: dto.weightKg },
      create: {
        userId,
        weightKg: dto.weightKg,
        loggedAt: date,
      },
    });

    return {
      id: entry.id,
      weightKg: Number(entry.weightKg),
      loggedAt: entry.loggedAt.toISOString().split('T')[0],
    };
  }

  async getHistory(userId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const logs = await this.prisma.weightLog.findMany({
      where: { userId, loggedAt: { gte: since } },
      orderBy: { loggedAt: 'asc' },
    });

    return logs.map((l) => ({
      id: l.id,
      weightKg: Number(l.weightKg),
      loggedAt: l.loggedAt.toISOString().split('T')[0],
    }));
  }

  async getTrend(userId: string) {
    const logs = await this.prisma.weightLog.findMany({
      where: { userId },
      orderBy: { loggedAt: 'desc' },
      take: 14,
    });

    if (logs.length === 0) return null;

    const current = Number(logs[0].weightKg);

    const recentWeek = logs.slice(0, 7);
    const previousWeek = logs.slice(7, 14);

    const weekAvg = recentWeek.reduce((sum, l) => sum + Number(l.weightKg), 0) / recentWeek.length;

    const prevWeekAvg =
      previousWeek.length > 0
        ? previousWeek.reduce((sum, l) => sum + Number(l.weightKg), 0) / previousWeek.length
        : null;

    return {
      current,
      weeklyAverage: Number(weekAvg.toFixed(1)),
      previousWeekAverage: prevWeekAvg ? Number(prevWeekAvg.toFixed(1)) : null,
      weeklyDelta: prevWeekAvg ? Number((weekAvg - prevWeekAvg).toFixed(1)) : null,
      dataPoints: logs.length,
    };
  }

  /**
   * Returns rolling-window averages over the user's full weight log history.
   * window=1  → raw daily entries (no smoothing)
   * window=N  → each point is the average of that entry and the N-1 preceding entries
   */
  async getRollingTrend(userId: string, window: number) {
    const logs = await this.prisma.weightLog.findMany({
      where: { userId },
      orderBy: { loggedAt: 'asc' },
    });

    if (logs.length === 0) return [];

    return logs.map((entry, idx) => {
      const start = Math.max(0, idx - window + 1);
      const slice = logs.slice(start, idx + 1);
      const avg = slice.reduce((sum, l) => sum + Number(l.weightKg), 0) / slice.length;
      return {
        date: entry.loggedAt.toISOString().split('T')[0],
        weightKg: Number(entry.weightKg),
        rollingAvg: Number(avg.toFixed(2)),
      };
    });
  }
}
