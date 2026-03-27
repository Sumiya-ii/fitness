/**
 * Compute the UTC day boundaries for a given YYYY-MM-DD date string.
 *
 * Returns `dayStart` as midnight UTC of that date and `dayEnd` as midnight UTC
 * of the following date, suitable for half-open range queries (`gte` / `lt`).
 */
export function dayBoundariesUTC(dateKey: string): { dayStart: Date; dayEnd: Date } {
  const dayStart = new Date(dateKey + 'T00:00:00.000Z');
  const dayEnd = new Date(dateKey + 'T00:00:00.000Z');
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  return { dayStart, dayEnd };
}
