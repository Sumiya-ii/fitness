import { Injectable } from '@nestjs/common';
import { toDateKeyInTZ } from '@coach/shared';
import { PrismaService } from '../prisma';

export interface StreakCalendarDay {
  date: string;
  logged: boolean;
}

export interface StreakData {
  /** Consecutive days with ≥1 meal logged, ending today (if logged) or yesterday */
  currentStreak: number;
  /** All-time longest consecutive logged streak */
  longestStreak: number;
  /** Percentage of last 7 days with ≥1 meal logged (0–100) */
  weekConsistency: number;
  /** Percentage of last 30 days with ≥1 meal logged (0–100) */
  monthConsistency: number;
  /** Whether the user has logged at least 1 meal today */
  todayLogged: boolean;
  /** Last 30 days in ascending order, each marked logged or not */
  calendar: StreakCalendarDay[];
}

const DEFAULT_TZ = 'Asia/Ulaanbaatar';

@Injectable()
export class StreaksService {
  constructor(private readonly prisma: PrismaService) {}

  async getStreaks(userId: string, tz?: string): Promise<StreakData> {
    // Timezone resolution priority:
    //  1. Caller-supplied ?tz query param (e.g. forwarded from mobile device)
    //  2. User's profiles.timezone (stored at onboarding, default 'Asia/Ulaanbaatar')
    //  3. Hard fallback: 'Asia/Ulaanbaatar'
    const resolvedTz = await this.resolveTimezone(userId, tz);

    // Fetch every distinct calendar date the user has logged a meal, converted
    // to the user's local timezone before extracting the date. Cast to text so
    // the driver always returns a plain 'YYYY-MM-DD' string.
    const rows = await this.prisma.$queryRaw<{ log_date: string }[]>`
      SELECT DISTINCT DATE(logged_at AT TIME ZONE 'UTC' AT TIME ZONE ${resolvedTz})::text AS log_date
      FROM "meal_logs"
      WHERE "user_id"::text = ${userId}
      ORDER BY log_date
    `;

    const loggedSet = new Set(rows.map((r) => r.log_date));

    const todayKey = toDateKeyInTZ(new Date(), resolvedTz);
    const todayLogged = loggedSet.has(todayKey);

    // ── Current streak ───────────────────────────────────────────────────────
    // Walk backwards from today (if logged) or yesterday (grace period) so the
    // streak number doesn't drop to 0 the moment a new day starts.
    const currentStreak = this.computeCurrentStreak(loggedSet, todayKey, todayLogged);

    // ── Longest streak (all-time) ─────────────────────────────────────────────
    const longestStreak = this.computeLongestStreak(rows.map((r) => r.log_date));

    // ── 30-day calendar ───────────────────────────────────────────────────────
    const calendar: StreakCalendarDay[] = [];
    for (let i = 29; i >= 0; i--) {
      const key = this.subtractDays(todayKey, i);
      calendar.push({ date: key, logged: loggedSet.has(key) });
    }

    const loggedDaysInMonth = calendar.filter((d) => d.logged).length;
    const loggedDaysInWeek = calendar.slice(23).filter((d) => d.logged).length; // last 7

    return {
      currentStreak,
      longestStreak,
      weekConsistency: Math.round((loggedDaysInWeek / 7) * 100),
      monthConsistency: Math.round((loggedDaysInMonth / 30) * 100),
      todayLogged,
      calendar,
    };
  }

  private computeCurrentStreak(
    loggedSet: Set<string>,
    todayKey: string,
    todayLogged: boolean,
  ): number {
    let streak = 0;
    // If today has no logs yet, start counting from yesterday so the streak
    // doesn't visually drop to 0 at midnight (same behaviour as Duolingo).
    let cursor = todayLogged ? todayKey : this.subtractDays(todayKey, 1);
    while (loggedSet.has(cursor)) {
      streak++;
      cursor = this.subtractDays(cursor, 1);
    }
    return streak;
  }

  private computeLongestStreak(sortedDates: string[]): number {
    if (sortedDates.length === 0) return 0;
    let longest = 1;
    let current = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1]!);
      const curr = new Date(sortedDates[i]!);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        current++;
        if (current > longest) longest = current;
      } else {
        current = 1;
      }
    }
    return longest;
  }

  /**
   * Resolve the timezone to use for date calculations.
   *
   * Priority:
   *   1. `requestTz` — caller-supplied (e.g. `?tz=` query param or `Time-Zone` header)
   *   2. `profiles.timezone` — stored on the user's profile (default 'Asia/Ulaanbaatar')
   *   3. DEFAULT_TZ ('Asia/Ulaanbaatar')
   *
   * Uses `Intl.DateTimeFormat` for validation — no new dependencies required.
   */
  private async resolveTimezone(userId: string, requestTz?: string): Promise<string> {
    if (requestTz && this.isValidTimezone(requestTz)) {
      return requestTz;
    }

    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { timezone: true },
    });

    const profileTz = profile?.timezone;
    if (profileTz && this.isValidTimezone(profileTz)) {
      return profileTz;
    }

    return DEFAULT_TZ;
  }

  /**
   * Validate an IANA timezone string using Intl.DateTimeFormat.
   * Returns false for unknown/invalid zones without throwing.
   */
  private isValidTimezone(tz: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Subtract `n` days from a YYYY-MM-DD date key using UTC noon to avoid any
   * DST edge case when crossing date boundaries.
   */
  private subtractDays(dateKey: string, n: number): string {
    const d = new Date(dateKey + 'T12:00:00.000Z');
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().split('T')[0]!;
  }
}
