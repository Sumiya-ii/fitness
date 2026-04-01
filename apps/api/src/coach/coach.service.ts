import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DateTime } from 'luxon';
import Redis from 'ioredis';
import * as Sentry from '@sentry/node';
import { PrismaService } from '../prisma';
import { ConfigService } from '../config';
import { QUEUE_NAMES } from '@coach/shared';
import { CoachContextService } from './coach-context.service';
import { CoachMemoryService } from '../coach-memory/coach-memory.service';
import {
  CoachJobData,
  CoachMessageType,
  CoachContext,
  COACH_COOLDOWNS,
  DAILY_MESSAGE_CAP,
} from './coach.types';

interface UserScheduleInfo {
  userId: string;
  timezone: string;
  channels: string[];
  chatId?: string;
  locale?: string;
  pushTokens?: string[];
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

@Injectable()
export class CoachService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly contextService: CoachContextService,
    private readonly memoryService: CoachMemoryService,
    @InjectQueue(QUEUE_NAMES.COACH_MESSAGES) private readonly coachQueue: Queue,
  ) {
    this.redis = new Redis(this.config.get('REDIS_URL'));
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  private cooldownKey(userId: string, type: CoachMessageType): string {
    return `coach:cooldown:${userId}:${type}`;
  }

  private dailyCountKey(userId: string, dateStr: string): string {
    return `coach:daily:${userId}:${dateStr}`;
  }

  async canSend(userId: string, type: CoachMessageType, timezone: string): Promise<boolean> {
    const dateStr = DateTime.now().setZone(timezone).toISODate()!;

    // Check daily cap
    const dailyKey = this.dailyCountKey(userId, dateStr);
    const dailyCount = parseInt((await this.redis.get(dailyKey)) ?? '0', 10);
    if (dailyCount >= DAILY_MESSAGE_CAP) return false;

    // Check cooldown
    const cooldownKey = this.cooldownKey(userId, type);
    const lastSent = await this.redis.get(cooldownKey);
    if (lastSent) return false;

    return true;
  }

  async markSent(userId: string, type: CoachMessageType, timezone: string): Promise<void> {
    const dateStr = DateTime.now().setZone(timezone).toISODate()!;
    const cooldown = COACH_COOLDOWNS[type];

    const dailyKey = this.dailyCountKey(userId, dateStr);
    const cooldownKey = this.cooldownKey(userId, type);

    // Atomic: increment daily count (expires at end of day + 1h buffer)
    const secondsUntilMidnight = Math.ceil(
      DateTime.now().setZone(timezone).endOf('day').diffNow('seconds').seconds,
    );
    await this.redis.incr(dailyKey);
    await this.redis.expire(dailyKey, secondsUntilMidnight + 3600);
    await this.redis.setex(cooldownKey, cooldown, '1');
  }

  private isInQuietHours(
    timezone: string,
    quietStart: string | null,
    quietEnd: string | null,
  ): boolean {
    if (!quietStart || !quietEnd) return false;
    const now = DateTime.now().setZone(timezone);
    const cur = now.hour * 60 + now.minute;
    const [sh, sm] = quietStart.split(':').map(Number);
    const [eh, em] = quietEnd.split(':').map(Number);
    const start = (sh ?? 0) * 60 + (sm ?? 0);
    const end = (eh ?? 0) * 60 + (em ?? 0);
    if (start <= end) return cur >= start && cur < end;
    return cur >= start || cur < end;
  }

  /**
   * Determine which message type (if any) should be sent to a user right now.
   * Returns null if no message is warranted.
   */
  private async pickMessageType(
    info: UserScheduleInfo,
    context: CoachContext,
  ): Promise<CoachMessageType | null> {
    const { userId, timezone } = info;
    const now = DateTime.now().setZone(timezone);
    const h = now.hour;
    const min = now.minute;
    const totalMin = h * 60 + min;
    const isSunday = now.weekday === 7;

    // Helper: check if in window [startH:startM, endH:endM) AND cooldown OK
    const check = async (
      type: CoachMessageType,
      windowStart: number,
      windowEnd: number,
    ): Promise<boolean> => {
      if (totalMin < windowStart || totalMin >= windowEnd) return false;
      return this.canSend(userId, type, timezone);
    };

    const { today, streak } = context;

    // Sunday 9-10 AM — weekly summary
    if (isSunday && (await check('weekly_summary', 9 * 60, 10 * 60))) return 'weekly_summary';

    // 7:30-8:30 AM — morning greeting
    if (await check('morning_greeting', 7 * 60 + 30, 8 * 60 + 30)) return 'morning_greeting';

    // Streak celebration: 3+ day streak at morning time (9-10 AM)
    if (streak.mealLoggingDays >= 3 && (await check('streak_celebration', 9 * 60, 10 * 60)))
      return 'streak_celebration';

    // 10-11 AM: water reminder if < 250 ml
    if (today.waterMl < 250 && (await check('water_reminder', 10 * 60, 11 * 60)))
      return 'water_reminder';

    // 11 AM - 12 PM: meal nudge if 0 meals logged
    if (today.mealsLogged === 0 && (await check('meal_nudge', 11 * 60, 12 * 60)))
      return 'meal_nudge';

    // 12-13 PM: midday check-in if < 1 meal logged
    if (today.mealsLogged < 1 && (await check('midday_checkin', 12 * 60, 13 * 60)))
      return 'midday_checkin';

    // 15-16: afternoon water if < 800 ml
    if (today.waterMl < 800 && (await check('water_reminder', 15 * 60, 16 * 60)))
      return 'water_reminder';

    // 17-18: water push if < 1200 ml
    if (today.waterMl < 1200 && (await check('water_reminder', 17 * 60, 18 * 60)))
      return 'water_reminder';

    // 18-19: meal nudge if < 2 meals
    if (today.mealsLogged < 2 && (await check('meal_nudge', 18 * 60, 19 * 60))) return 'meal_nudge';

    // 20-21: evening progress feedback (only if at least 1 meal logged)
    if (today.mealsLogged >= 1 && (await check('progress_feedback', 20 * 60, 21 * 60)))
      return 'progress_feedback';

    return null;
  }

  private async loadUsers(): Promise<UserScheduleInfo[]> {
    const prefs = await this.prisma.notificationPreference.findMany();
    const users: UserScheduleInfo[] = [];

    for (const pref of prefs) {
      const [tgLink, profile, deviceTokens] = await Promise.all([
        this.prisma.telegramLink.findUnique({ where: { userId: pref.userId } }),
        this.prisma.profile.findUnique({ where: { userId: pref.userId } }),
        this.prisma.deviceToken.findMany({
          where: { userId: pref.userId, active: true },
          select: { token: true },
        }),
      ]);

      users.push({
        userId: pref.userId,
        timezone: profile?.timezone ?? pref.reminderTimezone,
        channels: pref.channels,
        chatId: tgLink?.active ? (tgLink.chatId ?? undefined) : undefined,
        locale: profile?.locale ?? undefined,
        pushTokens: deviceTokens.map((d) => d.token),
        quietHoursStart: pref.quietHoursStart,
        quietHoursEnd: pref.quietHoursEnd,
      });
    }

    return users;
  }

  async scheduleCoachMessages(): Promise<number> {
    const users = await this.loadUsers();
    let enqueued = 0;

    for (const info of users) {
      if (this.isInQuietHours(info.timezone, info.quietHoursStart, info.quietHoursEnd)) {
        continue;
      }

      let context: CoachContext;
      try {
        // Use a placeholder type to build context; we'll update it after pick
        context = await this.contextService.buildContext(
          info.userId,
          info.timezone,
          'morning_greeting',
        );
      } catch (err) {
        Sentry.captureException(err, {
          tags: { service: 'coach', stage: 'build_context' },
          extra: { userId: info.userId },
        });
        continue;
      }

      const messageType = await this.pickMessageType(info, context);
      if (!messageType) continue;

      // Rebuild context with final message type
      context.messageType = messageType;

      const memoryBlock = await this.memoryService.getMemoryBlock(info.userId).catch(() => null);

      const jobData: CoachJobData = {
        userId: info.userId,
        messageType,
        channels: info.channels,
        chatId: info.chatId,
        locale: info.locale,
        pushTokens: info.pushTokens,
        context,
        memoryBlock: memoryBlock ?? undefined,
        timezone: info.timezone,
      };

      await this.coachQueue.add(messageType, jobData, {
        jobId: `coach-${info.userId}-${messageType}-${Date.now()}`,
      });

      await this.markSent(info.userId, messageType, info.timezone);
      enqueued++;
    }

    return enqueued;
  }
}
