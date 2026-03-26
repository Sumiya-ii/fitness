import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import {
  calculateCaloriesBurned,
  getWorkoutTypeInfo,
  getWorkoutCatalog,
  getWorkoutTypeList,
} from './met-calculator';
import { CreateWorkoutLogDto, UpdateWorkoutLogDto, WorkoutLogQueryDto } from './workout-logs.dto';

@Injectable()
export class WorkoutLogsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── CRUD ────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateWorkoutLogDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { weightKg: true },
    });

    const weightKg = profile?.weightKg ? Number(profile.weightKg) : 70;
    const calorieBurned =
      dto.durationMin != null
        ? calculateCaloriesBurned(dto.workoutType, dto.durationMin, weightKg)
        : null;

    const entry = await this.prisma.workoutLog.create({
      data: {
        userId,
        workoutType: dto.workoutType,
        durationMin: dto.durationMin ?? null,
        calorieBurned,
        note: dto.note ?? null,
        loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
      },
    });

    return this.format(entry);
  }

  async findByUser(userId: string, query: WorkoutLogQueryDto) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { userId };

    if (query.date) {
      const dayStart = new Date(query.date + 'T00:00:00.000Z');
      const dayEnd = new Date(query.date + 'T00:00:00.000Z');
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
      where.loggedAt = { gte: dayStart, lt: dayEnd };
    } else if (query.days) {
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - query.days);
      since.setUTCHours(0, 0, 0, 0);
      where.loggedAt = { gte: since };
    }

    const [entries, total] = await Promise.all([
      this.prisma.workoutLog.findMany({
        where,
        orderBy: { loggedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.workoutLog.count({ where }),
    ]);

    return {
      data: entries.map((e) => this.format(e)),
      meta: { total, page: query.page, limit: query.limit },
    };
  }

  async findById(userId: string, id: string) {
    const entry = await this.prisma.workoutLog.findFirst({ where: { id, userId } });
    if (!entry) throw new NotFoundException('Workout log not found');
    return this.format(entry);
  }

  async update(userId: string, id: string, dto: UpdateWorkoutLogDto) {
    const existing = await this.prisma.workoutLog.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Workout log not found');

    const workoutType = dto.workoutType ?? existing.workoutType;
    const durationMin = dto.durationMin !== undefined ? dto.durationMin : existing.durationMin;

    let calorieBurned = existing.calorieBurned;
    if (dto.workoutType !== undefined || dto.durationMin !== undefined) {
      if (durationMin != null) {
        const profile = await this.prisma.profile.findUnique({
          where: { userId },
          select: { weightKg: true },
        });
        const weightKg = profile?.weightKg ? Number(profile.weightKg) : 70;
        calorieBurned = calculateCaloriesBurned(workoutType, durationMin, weightKg);
      } else {
        calorieBurned = null;
      }
    }

    const entry = await this.prisma.workoutLog.update({
      where: { id },
      data: {
        workoutType,
        durationMin: durationMin ?? null,
        calorieBurned,
        note: dto.note !== undefined ? dto.note : existing.note,
        loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : existing.loggedAt,
      },
    });

    return this.format(entry);
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.workoutLog.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Workout log not found');
    await this.prisma.workoutLog.delete({ where: { id } });
  }

  // ── UX endpoints ────────────────────────────────────────────────────

  /** Calorie burn estimate without creating a log. */
  async estimate(userId: string, workoutType: string, durationMin: number) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { weightKg: true },
    });
    const weightKg = profile?.weightKg ? Number(profile.weightKg) : 70;
    const calorieBurned = calculateCaloriesBurned(workoutType, durationMin, weightKg);
    const typeInfo = getWorkoutTypeInfo(workoutType);

    return {
      workoutType,
      durationMin,
      weightKg,
      calorieBurned,
      label: typeInfo?.label ?? null,
      icon: typeInfo?.icon ?? null,
    };
  }

  /** Last N distinct workout types the user has logged (for quick re-log). */
  async getRecents(userId: string, limit = 5) {
    const recent = await this.prisma.workoutLog.findMany({
      where: { userId },
      orderBy: { loggedAt: 'desc' },
      take: 50, // fetch extra to get N distinct
      select: { workoutType: true, durationMin: true, calorieBurned: true },
    });

    const seen = new Set<string>();
    const recents: Array<{
      workoutType: string;
      durationMin: number | null;
      calorieBurned: number | null;
      label: { en: string; mn: string } | null;
      icon: string | null;
    }> = [];

    for (const entry of recent) {
      if (seen.has(entry.workoutType)) continue;
      seen.add(entry.workoutType);
      const info = getWorkoutTypeInfo(entry.workoutType);
      recents.push({
        workoutType: entry.workoutType,
        durationMin: entry.durationMin,
        calorieBurned: entry.calorieBurned,
        label: info?.label ?? null,
        icon: info?.icon ?? null,
      });
      if (recents.length >= limit) break;
    }

    return recents;
  }

  /** Weekly summary: total workouts, duration, calories burned. */
  async getWeeklySummary(userId: string) {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setUTCDate(weekStart.getUTCDate() - mondayOffset);
    weekStart.setUTCHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

    const entries = await this.prisma.workoutLog.findMany({
      where: {
        userId,
        loggedAt: { gte: weekStart, lt: weekEnd },
      },
      select: { workoutType: true, durationMin: true, calorieBurned: true, loggedAt: true },
      orderBy: { loggedAt: 'desc' },
    });

    const totalDurationMin = entries.reduce((sum, e) => sum + (e.durationMin ?? 0), 0);
    const totalCaloriesBurned = entries.reduce((sum, e) => sum + (e.calorieBurned ?? 0), 0);

    // Count by type
    const byType: Record<string, number> = {};
    for (const e of entries) {
      byType[e.workoutType] = (byType[e.workoutType] ?? 0) + 1;
    }

    // Days active (unique dates)
    const activeDays = new Set(entries.map((e) => e.loggedAt.toISOString().split('T')[0])).size;

    return {
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: new Date(weekEnd.getTime() - 1).toISOString().split('T')[0],
      workoutCount: entries.length,
      totalDurationMin,
      totalCaloriesBurned,
      activeDays,
      byType,
    };
  }

  /** Full workout type catalog for the mobile picker. */
  getTypes() {
    return getWorkoutCatalog();
  }

  /** Flat list for search. */
  getTypeList() {
    return getWorkoutTypeList();
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  async getDailyBurn(userId: string, dateStr: string): Promise<number> {
    const dayStart = new Date(dateStr + 'T00:00:00.000Z');
    const dayEnd = new Date(dateStr + 'T00:00:00.000Z');
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const entries = await this.prisma.workoutLog.findMany({
      where: { userId, loggedAt: { gte: dayStart, lt: dayEnd } },
      select: { calorieBurned: true },
    });

    return entries.reduce((sum, e) => sum + (e.calorieBurned ?? 0), 0);
  }

  private format(entry: {
    id: string;
    workoutType: string;
    durationMin: number | null;
    calorieBurned: number | null;
    note: string | null;
    loggedAt: Date;
    createdAt: Date;
  }) {
    const typeInfo = getWorkoutTypeInfo(entry.workoutType);
    return {
      id: entry.id,
      workoutType: entry.workoutType,
      durationMin: entry.durationMin,
      calorieBurned: entry.calorieBurned,
      note: entry.note,
      label: typeInfo?.label ?? null,
      icon: typeInfo?.icon ?? null,
      loggedAt: entry.loggedAt.toISOString(),
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
