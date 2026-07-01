import { Injectable } from '@nestjs/common';
import { dayBoundaries } from '@coach/shared';
import { PrismaService } from '../prisma';
import { CreateWeightLogDto } from './weight-logs.dto';

@Injectable()
export class WeightLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async log(userId: string, dto: CreateWeightLogDto) {
    // Bucket the entry by UTC calendar day so the day key matches every other
    // service and never rolls over to the wrong day from local-machine offsets.
    const dateKey = dto.loggedAt ?? new Date().toISOString().split('T')[0]!;
    const { dayStart: date } = dayBoundaries(dateKey);

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

  /**
   * Returns the weight-trend summary (current weight + rolling weekly average,
   * plus week-over-week delta) together with the smoothed `points` series the
   * chart renders. A single shape so the mobile store and chart read one source.
   */
  async getTrend(userId: string, window = 7) {
    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);
    const logs = await this.prisma.weightLog.findMany({
      where: { userId, loggedAt: { gte: since } },
      orderBy: { loggedAt: 'desc' },
      take: 365,
    });

    if (logs.length === 0) {
      return {
        current: null,
        weeklyAverage: null,
        previousWeekAverage: null,
        weeklyDelta: null,
        dataPoints: 0,
        points: [],
      };
    }

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
      points: this.rollingPoints(logs.slice().reverse(), window),
    };
  }

  /**
   * Build a chronologically-ascending rolling-average series.
   * Each point is the average of that entry and the `window - 1` preceding entries.
   */
  private rollingPoints(
    ascLogs: { loggedAt: Date; weightKg: unknown }[],
    window: number,
  ): { date: string; weightKg: number; rollingAvg: number }[] {
    return ascLogs.map((entry, idx) => {
      const start = Math.max(0, idx - window + 1);
      const slice = ascLogs.slice(start, idx + 1);
      const avg = slice.reduce((sum, l) => sum + Number(l.weightKg), 0) / slice.length;
      return {
        date: entry.loggedAt.toISOString().split('T')[0]!,
        weightKg: Number(entry.weightKg),
        rollingAvg: Number(avg.toFixed(2)),
      };
    });
  }

  /**
   * Returns rolling-window averages over the user's full weight log history.
   * window=1  → raw daily entries (no smoothing)
   * window=N  → each point is the average of that entry and the N-1 preceding entries
   */
  async getRollingTrend(userId: string, window: number) {
    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);
    const logs = await this.prisma.weightLog.findMany({
      where: { userId, loggedAt: { gte: since } },
      orderBy: { loggedAt: 'asc' },
      take: 365,
    });

    if (logs.length === 0) return [];

    return this.rollingPoints(logs, window);
  }
}
