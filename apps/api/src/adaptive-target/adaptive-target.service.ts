import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma';
import { QUEUE_NAMES } from '@coach/shared';
import {
  decideAdjustment,
  applyCalorieAdjustment,
  WeightEntry,
} from './adaptive-target-calculator';

export interface AdaptiveTargetJobData {
  userId: string;
  channels: string[];
  chatId?: string;
  locale?: string;
  pushTokens?: string[];
  adjustmentKcal: number;
  newCalorieTarget: number;
  goalType: string;
  reason: 'too_fast' | 'too_slow';
}

@Injectable()
export class AdaptiveTargetService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.ADAPTIVE_TARGET) private readonly adaptiveQueue: Queue,
  ) {}

  /**
   * Run the weekly adaptive calorie adjustment for all active lose_fat / gain targets.
   * Called every Sunday. Returns the number of targets adjusted.
   */
  async runWeeklyAdjustments(): Promise<number> {
    const targets = await this.prisma.target.findMany({
      where: {
        effectiveTo: null,
        goalType: { in: ['lose_fat', 'gain'] },
      },
      include: {
        user: {
          include: {
            notificationPrefs: true,
            telegramLink: true,
            deviceTokens: { where: { active: true }, select: { token: true } },
            profile: { select: { locale: true } },
          },
        },
      },
    });

    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    // Batch-fetch all weight logs for all affected users in a single query (avoids N+1)
    const userIds = targets.map((t) => t.userId);
    const allWeightLogs = await this.prisma.weightLog.findMany({
      where: {
        userId: { in: userIds },
        loggedAt: { gte: fourWeeksAgo },
      },
      orderBy: { loggedAt: 'asc' },
      select: { userId: true, loggedAt: true, weightKg: true },
    });

    const weightLogsByUser = new Map<string, typeof allWeightLogs>();
    for (const log of allWeightLogs) {
      const bucket = weightLogsByUser.get(log.userId) ?? [];
      bucket.push(log);
      weightLogsByUser.set(log.userId, bucket);
    }

    let adjusted = 0;

    for (const target of targets) {
      const weightLogs = weightLogsByUser.get(target.userId) ?? [];

      const entries: WeightEntry[] = weightLogs.map((w) => ({
        date: (w.loggedAt as Date).toISOString().split('T')[0]!,
        weightKg: Number(w.weightKg),
      }));

      const decision = decideAdjustment(
        target.goalType as 'lose_fat' | 'gain',
        Number(target.weeklyRateKg),
        entries,
      );

      if (!decision) continue;

      const newMacros = applyCalorieAdjustment(
        {
          calorieTarget: target.calorieTarget,
          proteinGrams: target.proteinGrams,
          fatGrams: target.fatGrams,
          carbsGrams: target.carbsGrams,
        },
        decision.adjustmentKcal,
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Close current target and open a new one (preserves history)
      await this.prisma.$transaction([
        this.prisma.target.update({
          where: { id: target.id },
          data: { effectiveTo: today },
        }),
        this.prisma.target.create({
          data: {
            userId: target.userId,
            goalType: target.goalType,
            calorieTarget: newMacros.calorieTarget,
            proteinGrams: newMacros.proteinGrams,
            carbsGrams: newMacros.carbsGrams,
            fatGrams: newMacros.fatGrams,
            weeklyRateKg: target.weeklyRateKg,
            effectiveFrom: today,
          },
        }),
      ]);

      // Enqueue notification — idempotent job ID prevents duplicate deliveries if cron re-runs
      const sundayStr = today.toISOString().split('T')[0];
      const { user } = target;
      const prefs = user.notificationPrefs;
      const channels = prefs?.channels ?? ['push'];
      const chatId =
        user.telegramLink?.active && user.telegramLink.chatId
          ? user.telegramLink.chatId
          : undefined;
      const pushTokens = user.deviceTokens.map((d) => d.token);
      const locale = user.profile?.locale ?? 'mn';

      const jobData: AdaptiveTargetJobData = {
        userId: target.userId,
        channels,
        chatId,
        locale,
        pushTokens,
        adjustmentKcal: decision.adjustmentKcal,
        newCalorieTarget: newMacros.calorieTarget,
        goalType: target.goalType,
        reason: decision.reason,
      };

      await this.adaptiveQueue.add('adaptive-target', jobData, {
        jobId: `adaptive-${target.userId}-${sundayStr}`,
      });

      adjusted++;
    }

    return adjusted;
  }
}
