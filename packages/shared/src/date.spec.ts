import { dayBoundariesUTC } from './date';

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
