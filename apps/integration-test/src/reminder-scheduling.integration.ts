/**
 * Reminder scheduling integration tests.
 *
 * Tests pure scheduling logic: quiet hours, meal timing computation,
 * and message variant completeness across all types and locales.
 *
 * No external API calls — all pure computation.
 *
 * Validates:
 *   - Quiet hours: same-day ranges, midnight-spanning ranges, null handling
 *   - Meal timing: breakfast rate, late-night detection, eating window
 *   - Message variants: all types × locales produce valid non-empty messages
 */
import { DateTime } from 'luxon';
import {
  isInQuietHours,
  computeInsights,
  getReminderMessage,
  getNudgeMessage,
  MORNING_VARIANTS_MN,
  MORNING_VARIANTS_EN,
  EVENING_VARIANTS_MN,
  EVENING_VARIANTS_EN,
  NUDGE_VARIANTS_MN,
  NUDGE_VARIANTS_EN,
} from './scheduling-helpers';

// ── Quiet hours logic ───────────────────────────────────────────────────────────

describe('Quiet hours logic', () => {
  it('returns false when quiet hours are null', () => {
    expect(isInQuietHours(14, 30, null, null)).toBe(false);
    expect(isInQuietHours(14, 30, '22:00', null)).toBe(false);
    expect(isInQuietHours(14, 30, null, '07:00')).toBe(false);
  });

  describe('same-day range (e.g. 13:00–15:00)', () => {
    it('detects time within range', () => {
      expect(isInQuietHours(14, 0, '13:00', '15:00')).toBe(true);
      expect(isInQuietHours(13, 0, '13:00', '15:00')).toBe(true);
      expect(isInQuietHours(14, 59, '13:00', '15:00')).toBe(true);
    });

    it('detects time outside range', () => {
      expect(isInQuietHours(12, 59, '13:00', '15:00')).toBe(false);
      expect(isInQuietHours(15, 0, '13:00', '15:00')).toBe(false);
      expect(isInQuietHours(15, 1, '13:00', '15:00')).toBe(false);
      expect(isInQuietHours(8, 0, '13:00', '15:00')).toBe(false);
    });
  });

  describe('midnight-spanning range (e.g. 22:00–07:00)', () => {
    it('detects late night within range', () => {
      expect(isInQuietHours(22, 0, '22:00', '07:00')).toBe(true);
      expect(isInQuietHours(23, 30, '22:00', '07:00')).toBe(true);
      expect(isInQuietHours(0, 0, '22:00', '07:00')).toBe(true);
      expect(isInQuietHours(3, 0, '22:00', '07:00')).toBe(true);
      expect(isInQuietHours(6, 59, '22:00', '07:00')).toBe(true);
    });

    it('detects daytime outside range', () => {
      expect(isInQuietHours(7, 0, '22:00', '07:00')).toBe(false);
      expect(isInQuietHours(8, 0, '22:00', '07:00')).toBe(false);
      expect(isInQuietHours(12, 0, '22:00', '07:00')).toBe(false);
      expect(isInQuietHours(21, 59, '22:00', '07:00')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles exact boundary (start equals end)', () => {
      // When start === end, the range is empty (same-day branch: start <= end)
      expect(isInQuietHours(10, 0, '10:00', '10:00')).toBe(false);
    });

    it('handles full-day range (00:00–23:59)', () => {
      expect(isInQuietHours(0, 0, '00:00', '23:59')).toBe(true);
      expect(isInQuietHours(12, 0, '00:00', '23:59')).toBe(true);
      expect(isInQuietHours(23, 58, '00:00', '23:59')).toBe(true);
    });
  });
});

// ── Meal timing computation ─────────────────────────────────────────────────────

describe('Meal timing computation', () => {
  const TZ = 'Asia/Ulaanbaatar'; // UTC+8

  /** Create a meal log at a specific local time */
  function makeMeal(
    isoDate: string,
    localHour: number,
    localMinute: number,
    mealType: string,
  ): { loggedAt: Date; mealType: string } {
    const dt = DateTime.fromISO(
      `${isoDate}T${localHour.toString().padStart(2, '0')}:${localMinute.toString().padStart(2, '0')}:00`,
      { zone: TZ },
    );
    return { loggedAt: dt.toJSDate(), mealType };
  }

  // Week: Monday 2026-03-23 to Sunday 2026-03-29
  const weekStart = DateTime.fromISO('2026-03-23', { zone: TZ });

  describe('breakfast rate calculation', () => {
    it('computes 100% weekday rate when breakfast logged every weekday', () => {
      const logs = [
        makeMeal('2026-03-23', 8, 0, 'breakfast'), // Mon
        makeMeal('2026-03-24', 8, 30, 'breakfast'), // Tue
        makeMeal('2026-03-25', 7, 45, 'breakfast'), // Wed
        makeMeal('2026-03-26', 8, 15, 'breakfast'), // Thu
        makeMeal('2026-03-27', 9, 0, 'breakfast'), // Fri
      ];

      const result = computeInsights(logs, TZ, weekStart);
      expect(result.breakfastWeekdayRate).toBe(100);
    });

    it('computes 40% weekday rate when only 2/5 weekdays have breakfast', () => {
      const logs = [
        makeMeal('2026-03-23', 8, 0, 'breakfast'), // Mon
        makeMeal('2026-03-25', 8, 0, 'breakfast'), // Wed
        makeMeal('2026-03-24', 12, 0, 'lunch'), // Tue (no breakfast)
        makeMeal('2026-03-26', 12, 0, 'lunch'), // Thu (no breakfast)
        makeMeal('2026-03-27', 12, 0, 'lunch'), // Fri (no breakfast)
      ];

      const result = computeInsights(logs, TZ, weekStart);
      expect(result.breakfastWeekdayRate).toBe(40);
    });

    it('computes 50% weekend rate when breakfast on 1/2 weekend days', () => {
      const logs = [
        makeMeal('2026-03-28', 9, 0, 'breakfast'), // Sat
        makeMeal('2026-03-29', 12, 0, 'lunch'), // Sun (no breakfast)
      ];

      const result = computeInsights(logs, TZ, weekStart);
      expect(result.breakfastWeekendRate).toBe(50);
    });

    it('computes 0% when no breakfast logged', () => {
      const logs = [
        makeMeal('2026-03-23', 12, 0, 'lunch'),
        makeMeal('2026-03-24', 12, 0, 'lunch'),
        makeMeal('2026-03-25', 19, 0, 'dinner'),
      ];

      const result = computeInsights(logs, TZ, weekStart);
      expect(result.breakfastWeekdayRate).toBe(0);
      expect(result.breakfastWeekendRate).toBe(0);
    });
  });

  describe('late-night eating detection', () => {
    it('counts days with meals after 20:00', () => {
      const logs = [
        makeMeal('2026-03-23', 21, 30, 'snack'), // Mon late
        makeMeal('2026-03-24', 22, 0, 'dinner'), // Tue late
        makeMeal('2026-03-25', 20, 0, 'dinner'), // Wed exactly 20:00 (>= 20 counts)
        makeMeal('2026-03-26', 19, 30, 'dinner'), // Thu not late
        makeMeal('2026-03-27', 18, 0, 'dinner'), // Fri not late
      ];

      const result = computeInsights(logs, TZ, weekStart);
      expect(result.lateNightEatingDays).toBe(3);
    });

    it('returns 0 when no late-night eating', () => {
      const logs = [
        makeMeal('2026-03-23', 8, 0, 'breakfast'),
        makeMeal('2026-03-23', 12, 0, 'lunch'),
        makeMeal('2026-03-23', 18, 0, 'dinner'),
      ];

      const result = computeInsights(logs, TZ, weekStart);
      expect(result.lateNightEatingDays).toBe(0);
    });
  });

  describe('eating window calculation', () => {
    it('computes average eating window across days with 2+ meals', () => {
      const logs = [
        // Mon: 8:00 to 19:00 = 11h = 660 min
        makeMeal('2026-03-23', 8, 0, 'breakfast'),
        makeMeal('2026-03-23', 12, 0, 'lunch'),
        makeMeal('2026-03-23', 19, 0, 'dinner'),
        // Tue: 9:00 to 21:00 = 12h = 720 min
        makeMeal('2026-03-24', 9, 0, 'breakfast'),
        makeMeal('2026-03-24', 21, 0, 'dinner'),
      ];

      const result = computeInsights(logs, TZ, weekStart);
      // Average: (660 + 720) / 2 = 690 min
      expect(result.avgEatingWindowMinutes).toBe(690);
    });

    it('returns null when all days have only 1 meal', () => {
      const logs = [
        makeMeal('2026-03-23', 12, 0, 'lunch'),
        makeMeal('2026-03-24', 13, 0, 'lunch'),
        makeMeal('2026-03-25', 12, 30, 'lunch'),
      ];

      const result = computeInsights(logs, TZ, weekStart);
      expect(result.avgEatingWindowMinutes).toBeNull();
    });

    it('ignores single-meal days in window calculation', () => {
      const logs = [
        // Mon: only 1 meal (excluded from window calc)
        makeMeal('2026-03-23', 12, 0, 'lunch'),
        // Tue: 8:00 to 20:00 = 12h = 720 min
        makeMeal('2026-03-24', 8, 0, 'breakfast'),
        makeMeal('2026-03-24', 20, 0, 'dinner'),
      ];

      const result = computeInsights(logs, TZ, weekStart);
      expect(result.avgEatingWindowMinutes).toBe(720);
    });
  });

  describe('meal stats', () => {
    it('computes per-type average hour and count', () => {
      const logs = [
        makeMeal('2026-03-23', 8, 0, 'breakfast'),
        makeMeal('2026-03-24', 9, 0, 'breakfast'),
        makeMeal('2026-03-23', 12, 0, 'lunch'),
        makeMeal('2026-03-24', 13, 0, 'lunch'),
        makeMeal('2026-03-25', 12, 30, 'lunch'),
      ];

      const result = computeInsights(logs, TZ, weekStart);

      const breakfast = result.mealStats.find((s) => s.mealType === 'breakfast');
      expect(breakfast).toBeDefined();
      expect(breakfast!.count).toBe(2);
      expect(breakfast!.avgHour).toBeCloseTo(8.5, 0);

      const lunch = result.mealStats.find((s) => s.mealType === 'lunch');
      expect(lunch).toBeDefined();
      expect(lunch!.count).toBe(3);
    });

    it('defaults null mealType to snack', () => {
      const logs = [{ loggedAt: makeMeal('2026-03-23', 15, 0, 'snack').loggedAt, mealType: null }];

      const result = computeInsights(logs, TZ, weekStart);

      const snack = result.mealStats.find((s) => s.mealType === 'snack');
      expect(snack).toBeDefined();
      expect(snack!.count).toBe(1);
    });
  });

  describe('highlights generation', () => {
    it('flags low breakfast rate', () => {
      const logs = [
        makeMeal('2026-03-23', 12, 0, 'lunch'),
        makeMeal('2026-03-24', 12, 0, 'lunch'),
        makeMeal('2026-03-25', 12, 0, 'lunch'),
      ];

      const result = computeInsights(logs, TZ, weekStart);
      expect(result.highlights.some((h) => h.includes('зөвхөн'))).toBe(true);
    });

    it('flags frequent late-night eating', () => {
      const logs = [
        makeMeal('2026-03-23', 21, 0, 'dinner'),
        makeMeal('2026-03-24', 22, 0, 'snack'),
        makeMeal('2026-03-25', 20, 30, 'dinner'),
      ];

      const result = computeInsights(logs, TZ, weekStart);
      expect(result.highlights.some((h) => h.includes('20:00'))).toBe(true);
    });

    it('flags wide eating window', () => {
      const logs = [
        makeMeal('2026-03-23', 6, 0, 'breakfast'),
        makeMeal('2026-03-23', 22, 0, 'snack'),
        makeMeal('2026-03-24', 7, 0, 'breakfast'),
        makeMeal('2026-03-24', 21, 0, 'dinner'),
      ];

      const result = computeInsights(logs, TZ, weekStart);
      expect(result.avgEatingWindowMinutes).toBeGreaterThan(12 * 60);
      expect(result.highlights.some((h) => h.includes('богиносговол'))).toBe(true);
    });
  });

  describe('full realistic week', () => {
    it('computes correct insights for a typical Mongolian user', () => {
      const logs = [
        // Monday
        makeMeal('2026-03-23', 8, 30, 'breakfast'),
        makeMeal('2026-03-23', 12, 30, 'lunch'),
        makeMeal('2026-03-23', 19, 0, 'dinner'),
        // Tuesday (skipped breakfast)
        makeMeal('2026-03-24', 13, 0, 'lunch'),
        makeMeal('2026-03-24', 20, 30, 'dinner'),
        // Wednesday
        makeMeal('2026-03-25', 9, 0, 'breakfast'),
        makeMeal('2026-03-25', 12, 0, 'lunch'),
        makeMeal('2026-03-25', 18, 30, 'dinner'),
        makeMeal('2026-03-25', 22, 0, 'snack'), // late night
        // Thursday (skipped breakfast)
        makeMeal('2026-03-26', 12, 30, 'lunch'),
        makeMeal('2026-03-26', 19, 30, 'dinner'),
        // Friday
        makeMeal('2026-03-27', 8, 0, 'breakfast'),
        makeMeal('2026-03-27', 12, 0, 'lunch'),
        makeMeal('2026-03-27', 21, 0, 'dinner'), // late night
        // Saturday
        makeMeal('2026-03-28', 10, 0, 'breakfast'),
        makeMeal('2026-03-28', 14, 0, 'lunch'),
        makeMeal('2026-03-28', 20, 0, 'dinner'), // late night
        // Sunday (skipped breakfast)
        makeMeal('2026-03-29', 13, 0, 'lunch'),
        makeMeal('2026-03-29', 18, 0, 'dinner'),
      ];

      const result = computeInsights(logs, TZ, weekStart);

      // Weekday breakfast: Mon, Wed, Fri = 3/5 = 60%
      expect(result.breakfastWeekdayRate).toBe(60);

      // Weekend breakfast: Sat only = 1/2 = 50%
      expect(result.breakfastWeekendRate).toBe(50);

      // Late night: Tue (20:30), Wed (22:00), Fri (21:00), Sat (20:00) = 4 days
      expect(result.lateNightEatingDays).toBe(4);

      // Week boundaries
      expect(result.weekStart).toBe('2026-03-23');
      expect(result.weekEnd).toBe('2026-03-29');

      // All meal types represented
      const types = result.mealStats.map((s) => s.mealType).sort();
      expect(types).toContain('breakfast');
      expect(types).toContain('lunch');
      expect(types).toContain('dinner');

      // Eating window should be reasonable (10-14 hours)
      expect(result.avgEatingWindowMinutes).not.toBeNull();
      expect(result.avgEatingWindowMinutes!).toBeGreaterThan(5 * 60);
      expect(result.avgEatingWindowMinutes!).toBeLessThan(16 * 60);
    });
  });
});

// ── Message variant completeness ────────────────────────────────────────────────

describe('Message variant completeness', () => {
  describe('reminder messages', () => {
    const types: Array<'morning' | 'evening'> = ['morning', 'evening'];
    const locales = ['mn', 'en', 'unknown'];

    for (const type of types) {
      for (const locale of locales) {
        it(`${type}/${locale} returns a valid message`, () => {
          const msg = getReminderMessage(type, locale);
          expect(msg.title.length).toBeGreaterThan(0);
          expect(msg.body.length).toBeGreaterThan(0);
        });
      }
    }
  });

  describe('nudge messages', () => {
    const locales = ['mn', 'en', 'unknown'];

    for (const locale of locales) {
      it(`${locale} returns a valid message`, () => {
        const msg = getNudgeMessage(locale);
        expect(msg.title.length).toBeGreaterThan(0);
        expect(msg.body.length).toBeGreaterThan(0);
      });
    }
  });

  it('Mongolian morning variants have 3 options', () => {
    expect(MORNING_VARIANTS_MN.length).toBe(3);
  });

  it('English morning variants have 3 options', () => {
    expect(MORNING_VARIANTS_EN.length).toBe(3);
  });

  it('Mongolian evening variants have 2 options', () => {
    expect(EVENING_VARIANTS_MN.length).toBe(2);
  });

  it('English evening variants have 2 options', () => {
    expect(EVENING_VARIANTS_EN.length).toBe(2);
  });

  it('Mongolian nudge variants have 3 options', () => {
    expect(NUDGE_VARIANTS_MN.length).toBe(3);
  });

  it('English nudge variants have 3 options', () => {
    expect(NUDGE_VARIANTS_EN.length).toBe(3);
  });

  it('unknown locale defaults to Mongolian for reminders', () => {
    const msg = getReminderMessage('morning', 'fr');
    const allMnBodies = MORNING_VARIANTS_MN.map((v) => v.body);
    expect(allMnBodies).toContain(msg.body);
  });

  it('unknown locale defaults to Mongolian for nudges', () => {
    const msg = getNudgeMessage('jp');
    const allMnBodies = NUDGE_VARIANTS_MN.map((v) => v.body);
    expect(allMnBodies).toContain(msg.body);
  });
});
