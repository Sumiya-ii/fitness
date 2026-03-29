/**
 * Scheduling logic helpers for integration tests.
 *
 * Mirrors pure functions from:
 *   - reminders.service.ts (quiet hours)
 *   - meal-timing.service.ts (computeInsights)
 *   - reminders.processor.ts / meal-nudge.processor.ts (message variants)
 */
import { DateTime } from 'luxon';

// ── Quiet hours logic (mirrors RemindersService.isInQuietHours) ─────────────────

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map((x) => parseInt(x, 10));
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Check if a given hour:minute falls within quiet hours.
 * Handles midnight-spanning ranges (e.g. 22:00–07:00).
 */
export function isInQuietHours(
  currentHour: number,
  currentMinute: number,
  quietStart: string | null,
  quietEnd: string | null,
): boolean {
  if (!quietStart || !quietEnd) return false;

  const currentMinutes = currentHour * 60 + currentMinute;
  const startMinutes = parseTimeToMinutes(quietStart);
  const endMinutes = parseTimeToMinutes(quietEnd);

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

// ── Meal timing computation (mirrors MealTimingService.computeInsights) ─────────

export interface MealTimingStat {
  mealType: string;
  avgHour: number;
  count: number;
}

export interface MealTimingInsights {
  weekStart: string;
  weekEnd: string;
  mealStats: MealTimingStat[];
  breakfastWeekdayRate: number;
  breakfastWeekendRate: number;
  lateNightEatingDays: number;
  avgEatingWindowMinutes: number | null;
  highlights: string[];
}

export function computeInsights(
  mealLogs: Array<{ loggedAt: Date; mealType: string | null }>,
  timezone: string,
  weekStart: DateTime,
): MealTimingInsights {
  const weekEnd = weekStart.plus({ days: 6 });

  const localLogs = mealLogs.map((log) => {
    const dt = DateTime.fromJSDate(log.loggedAt).setZone(timezone);
    return {
      mealType: (log.mealType ?? 'snack').toLowerCase(),
      hour: dt.hour + dt.minute / 60 + dt.second / 3600,
      weekday: dt.weekday,
      dateKey: dt.toISODate()!,
    };
  });

  // Per meal-type average hour
  const byType = new Map<string, number[]>();
  for (const log of localLogs) {
    const arr = byType.get(log.mealType) ?? [];
    arr.push(log.hour);
    byType.set(log.mealType, arr);
  }

  const mealStats: MealTimingStat[] = Array.from(byType.entries()).map(([mealType, hours]) => ({
    mealType,
    avgHour: hours.reduce((s, h) => s + h, 0) / hours.length,
    count: hours.length,
  }));

  // Breakfast frequency
  const breakfastLogs = localLogs.filter((l) => l.mealType === 'breakfast');
  const breakfastDays = new Set(breakfastLogs.map((l) => l.dateKey));

  const weekdayDates: string[] = [];
  const weekendDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = weekStart.plus({ days: i });
    if (d.weekday <= 5) weekdayDates.push(d.toISODate()!);
    else weekendDates.push(d.toISODate()!);
  }

  const breakfastWeekdayRate =
    weekdayDates.length > 0
      ? Math.round(
          (weekdayDates.filter((d) => breakfastDays.has(d)).length / weekdayDates.length) * 100,
        )
      : 0;

  const breakfastWeekendRate =
    weekendDates.length > 0
      ? Math.round(
          (weekendDates.filter((d) => breakfastDays.has(d)).length / weekendDates.length) * 100,
        )
      : 0;

  // Late-night eating
  const lateNightDays = new Set(localLogs.filter((l) => l.hour >= 20).map((l) => l.dateKey));
  const lateNightEatingDays = lateNightDays.size;

  // Eating window
  const byDay = new Map<string, { minHour: number; maxHour: number; count: number }>();
  for (const log of localLogs) {
    const existing = byDay.get(log.dateKey);
    if (!existing) {
      byDay.set(log.dateKey, { minHour: log.hour, maxHour: log.hour, count: 1 });
    } else {
      existing.minHour = Math.min(existing.minHour, log.hour);
      existing.maxHour = Math.max(existing.maxHour, log.hour);
      existing.count++;
    }
  }

  const dayWindows = Array.from(byDay.values()).filter((d) => d.count >= 2);
  const avgEatingWindowMinutes =
    dayWindows.length > 0
      ? Math.round(
          dayWindows.reduce((s, d) => s + (d.maxHour - d.minHour) * 60, 0) / dayWindows.length,
        )
      : null;

  // Highlights
  const highlights: string[] = [];

  if (breakfastWeekdayRate < 60) {
    highlights.push(
      `Та ажлын өдрүүдийн зөвхөн ${breakfastWeekdayRate}%-д өглөөний хоол идсэн байна.`,
    );
  } else {
    highlights.push(
      `Та ажлын өдрүүдийн ${breakfastWeekdayRate}%-д өглөөний хоолоо цагтаа идсэн байна.`,
    );
  }

  if (lateNightEatingDays >= 3) {
    highlights.push(
      `7 хоногийн ${lateNightEatingDays} өдөр шөнийн 20:00-аас хойш хоол идсэн байна.`,
    );
  }

  if (avgEatingWindowMinutes !== null) {
    const hours = Math.floor(avgEatingWindowMinutes / 60);
    const mins = avgEatingWindowMinutes % 60;
    const windowStr = mins > 0 ? `${hours} цаг ${mins} минут` : `${hours} цаг`;
    if (avgEatingWindowMinutes > 12 * 60) {
      highlights.push(
        `Таны өдрийн хоол идэх цонх дунджаар ${windowStr} байна — бага зэрэг богиносговол ашигтай.`,
      );
    } else {
      highlights.push(`Таны өдрийн хоол идэх цонх дунджаар ${windowStr} байна.`);
    }
  }

  return {
    weekStart: weekStart.toISODate()!,
    weekEnd: weekEnd.toISODate()!,
    mealStats,
    breakfastWeekdayRate,
    breakfastWeekendRate,
    lateNightEatingDays,
    avgEatingWindowMinutes,
    highlights,
  };
}

// ── Message variant definitions (mirrors processor files) ───────────────────────

interface MessageVariant {
  title: string;
  body: string;
}

export const MORNING_VARIANTS_MN: MessageVariant[] = [
  {
    title: 'Өглөөний мэнд! 🌅',
    body: 'Шинэ өдөр, шинэ боломж. Өглөөний цайгаа юу болгох вэ?',
  },
  {
    title: 'Өглөө болж байна! ☀️',
    body: 'Өнөөдөр юу идэхээ төлөвлөж байна уу? Coach бэлэн.',
  },
  {
    title: 'Сайн уу! 💪',
    body: 'Өчигдөр сайн хоол бүртгэсэн. Өнөөдөр ч тэгцгээе!',
  },
];

export const MORNING_VARIANTS_EN: MessageVariant[] = [
  {
    title: 'Good morning! 🌅',
    body: "New day, fresh start. What's the breakfast plan?",
  },
  {
    title: 'Rise and shine! ☀️',
    body: "What's on the menu today? Coach is ready when you are.",
  },
  {
    title: 'Morning! 💪',
    body: "You logged well yesterday. Let's keep the momentum going!",
  },
];

export const EVENING_VARIANTS_MN: MessageVariant[] = [
  {
    title: 'Оройн мэнд! 🌙',
    body: 'Өнөөдрийн хоолоо бүртгэхээ мартсан уу? Орохоосоо өмнө нэмж болно.',
  },
  {
    title: 'Өдөр дуусаж байна 📊',
    body: 'Өнөөдрийн хоолоо нэмвэл бүрэн зураг харагдана.',
  },
];

export const EVENING_VARIANTS_EN: MessageVariant[] = [
  {
    title: 'Good evening! 🌙',
    body: "Forgot to log today? There's still time before bed.",
  },
  {
    title: "Day's wrapping up 📊",
    body: 'Add your meals to see the full picture of today.',
  },
];

export const NUDGE_VARIANTS_MN: MessageVariant[] = [
  {
    title: 'Оройн хоолонд юу идсэн бэ? 🍜',
    body: 'Өнөөдөр нэг л хоол бүртгэгдсэн. Оройн хоолоо нэмэх үү?',
  },
  {
    title: 'Хоолны бүртгэл дутуу байна 📝',
    body: 'Бүртгэл тогтвортой байх тусам зорилтод ойртоно. Юу идсэнээ нэмэх үү?',
  },
  {
    title: 'Өнөөдрийн хоол сонирхолтой байна 🤔',
    body: 'Нэг хоол бүртгэгдсэн — үлдсэнийг нь нэмэх үү?',
  },
];

export const NUDGE_VARIANTS_EN: MessageVariant[] = [
  {
    title: "What's for dinner? 🍜",
    body: 'Only one meal logged today. Want to add the rest?',
  },
  {
    title: 'Your log is looking light 📝',
    body: 'Consistent logging = better results. What else did you eat today?',
  },
  {
    title: "Today's meals look interesting 🤔",
    body: 'One meal down — want to add the rest?',
  },
];

export function getReminderMessage(type: 'morning' | 'evening', lang: string): MessageVariant {
  const variants =
    type === 'morning'
      ? lang === 'en'
        ? MORNING_VARIANTS_EN
        : MORNING_VARIANTS_MN
      : lang === 'en'
        ? EVENING_VARIANTS_EN
        : EVENING_VARIANTS_MN;
  return variants[Math.floor(Math.random() * variants.length)]!;
}

export function getNudgeMessage(lang: string): MessageVariant {
  const variants = lang === 'en' ? NUDGE_VARIANTS_EN : NUDGE_VARIANTS_MN;
  return variants[Math.floor(Math.random() * variants.length)]!;
}
