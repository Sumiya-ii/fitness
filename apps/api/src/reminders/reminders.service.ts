import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma';
import { QUEUE_NAMES } from '@coach/shared';

export type ReminderType = 'morning' | 'evening';

export interface ReminderJobData {
  userId: string;
  type: ReminderType;
  channels: string[];
}

/**
 * Get current hour (0-23) and minute (0-59) in the given timezone.
 */
function getLocalTimeParts(timezone: string): { hour: number; minute: number } {
  const dt = DateTime.now().setZone(timezone);
  return { hour: dt.hour, minute: dt.minute };
}

/**
 * Parse "HH:mm" string to minutes since midnight.
 */
function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map((x) => parseInt(x, 10));
  return (h ?? 0) * 60 + (m ?? 0);
}

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.REMINDERS) private readonly reminderQueue: Queue,
  ) {}

  /**
   * Check if current time in user's timezone falls within quiet hours.
   * quietStart/quietEnd are "HH:mm" (e.g. "22:00", "07:00").
   * When quiet hours span midnight (e.g. 22:00–07:00), we're in quiet hours if
   * current >= start OR current < end.
   */
  isInQuietHours(
    timezone: string,
    quietStart: string | null,
    quietEnd: string | null,
  ): boolean {
    if (!quietStart || !quietEnd) return false;

    const { hour, minute } = getLocalTimeParts(timezone);
    const currentMinutes = hour * 60 + minute;
    const startMinutes = parseTimeToMinutes(quietStart);
    const endMinutes = parseTimeToMinutes(quietEnd);

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  /**
   * Schedule morning reminders for users whose local time is 8–9 AM.
   */
  async scheduleMorningReminders(): Promise<number> {
    const prefs = await this.prisma.notificationPreference.findMany({
      where: { morningReminder: true },
    });

    let enqueued = 0;

    for (const pref of prefs) {
      const { hour: localHour } = getLocalTimeParts(pref.reminderTimezone);
      if (localHour < 8 || localHour >= 9) continue;

      if (this.isInQuietHours(pref.reminderTimezone, pref.quietHoursStart, pref.quietHoursEnd)) {
        continue;
      }

      await this.reminderQueue.add(
        'morning',
        {
          userId: pref.userId,
          type: 'morning' as ReminderType,
          channels: pref.channels,
        } satisfies ReminderJobData,
        { jobId: `morning-${pref.userId}-${Date.now()}` },
      );
      enqueued++;
    }

    return enqueued;
  }

  /**
   * Schedule evening reminders for users whose local time is 8–9 PM
   * and who haven't logged any meals today.
   */
  async scheduleEveningReminders(): Promise<number> {
    const prefs = await this.prisma.notificationPreference.findMany({
      where: { eveningReminder: true },
    });

    let enqueued = 0;

    for (const pref of prefs) {
      const { hour: localHour } = getLocalTimeParts(pref.reminderTimezone);
      if (localHour < 20 || localHour >= 21) continue;

      if (this.isInQuietHours(pref.reminderTimezone, pref.quietHoursStart, pref.quietHoursEnd)) {
        continue;
      }

      const todayStart = this.getLocalDayStart(pref.reminderTimezone);
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      const mealCount = await this.prisma.mealLog.count({
        where: {
          userId: pref.userId,
          loggedAt: { gte: todayStart, lt: todayEnd },
        },
      });

      if (mealCount > 0) continue;

      await this.reminderQueue.add(
        'evening',
        {
          userId: pref.userId,
          type: 'evening' as ReminderType,
          channels: pref.channels,
        } satisfies ReminderJobData,
        { jobId: `evening-${pref.userId}-${Date.now()}` },
      );
      enqueued++;
    }

    return enqueued;
  }

  /**
   * Get start of today (00:00) in the given timezone as UTC Date.
   */
  private getLocalDayStart(timezone: string): Date {
    const start = DateTime.now().setZone(timezone).startOf('day');
    return start.toJSDate();
  }
}
