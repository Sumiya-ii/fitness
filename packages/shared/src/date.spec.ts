import { dayBoundariesUTC, dayBoundaries, toLocalDateKey, toDateKeyInTZ } from './date';

describe('dayBoundariesUTC', () => {
  it('returns midnight-to-midnight UTC boundaries for a given date', () => {
    const { dayStart, dayEnd } = dayBoundariesUTC('2026-03-15');
    expect(dayStart.toISOString()).toBe('2026-03-15T00:00:00.000Z');
    expect(dayEnd.toISOString()).toBe('2026-03-16T00:00:00.000Z');
  });

  it('handles month rollover', () => {
    const { dayStart, dayEnd } = dayBoundariesUTC('2026-01-31');
    expect(dayStart.toISOString()).toBe('2026-01-31T00:00:00.000Z');
    expect(dayEnd.toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });

  it('handles year rollover', () => {
    const { dayStart, dayEnd } = dayBoundariesUTC('2025-12-31');
    expect(dayStart.toISOString()).toBe('2025-12-31T00:00:00.000Z');
    expect(dayEnd.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('handles leap day', () => {
    const { dayStart, dayEnd } = dayBoundariesUTC('2024-02-29');
    expect(dayStart.toISOString()).toBe('2024-02-29T00:00:00.000Z');
    expect(dayEnd.toISOString()).toBe('2024-03-01T00:00:00.000Z');
  });
});

describe('dayBoundaries', () => {
  it('falls back to UTC when no timezone is provided', () => {
    const { dayStart, dayEnd } = dayBoundaries('2026-03-15');
    expect(dayStart.toISOString()).toBe('2026-03-15T00:00:00.000Z');
    expect(dayEnd.toISOString()).toBe('2026-03-16T00:00:00.000Z');
  });

  it('computes midnight in Asia/Ulaanbaatar (UTC+8)', () => {
    // Midnight in UB on March 15 = 2026-03-14T16:00:00Z
    const { dayStart, dayEnd } = dayBoundaries('2026-03-15', 'Asia/Ulaanbaatar');
    expect(dayStart.toISOString()).toBe('2026-03-14T16:00:00.000Z');
    expect(dayEnd.toISOString()).toBe('2026-03-15T16:00:00.000Z');
  });

  it('computes midnight in US/Eastern (UTC-5 in winter)', () => {
    // Midnight in New York on Jan 15 = 2026-01-15T05:00:00Z
    const { dayStart, dayEnd } = dayBoundaries('2026-01-15', 'America/New_York');
    expect(dayStart.toISOString()).toBe('2026-01-15T05:00:00.000Z');
    expect(dayEnd.toISOString()).toBe('2026-01-16T05:00:00.000Z');
  });

  it('computes midnight in US/Eastern during DST (UTC-4)', () => {
    // Midnight in New York on July 15 = 2026-07-15T04:00:00Z
    const { dayStart, dayEnd } = dayBoundaries('2026-07-15', 'America/New_York');
    expect(dayStart.toISOString()).toBe('2026-07-15T04:00:00.000Z');
    expect(dayEnd.toISOString()).toBe('2026-07-16T04:00:00.000Z');
  });

  it('handles UTC timezone explicitly', () => {
    const { dayStart, dayEnd } = dayBoundaries('2026-03-15', 'UTC');
    expect(dayStart.toISOString()).toBe('2026-03-15T00:00:00.000Z');
    expect(dayEnd.toISOString()).toBe('2026-03-16T00:00:00.000Z');
  });
});

describe('toLocalDateKey', () => {
  it('formats a date using local date components', () => {
    // We can't test exact output since it depends on the test runner's TZ,
    // but we can verify the format
    const result = toLocalDateKey(new Date('2026-03-15T12:00:00Z'));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('toDateKeyInTZ', () => {
  it('formats a UTC date in the given timezone', () => {
    // 2026-03-15T20:00:00Z in Asia/Ulaanbaatar (UTC+8) is 2026-03-16 04:00
    const date = new Date('2026-03-15T20:00:00Z');
    expect(toDateKeyInTZ(date, 'Asia/Ulaanbaatar')).toBe('2026-03-16');
  });

  it('falls back to UTC date extraction when no tz', () => {
    const date = new Date('2026-03-15T20:00:00Z');
    expect(toDateKeyInTZ(date)).toBe('2026-03-15');
  });

  it('returns UTC date for UTC timezone', () => {
    const date = new Date('2026-03-15T23:00:00Z');
    expect(toDateKeyInTZ(date, 'UTC')).toBe('2026-03-15');
  });
});
