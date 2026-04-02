/**
 * Compute the UTC day boundaries for a given YYYY-MM-DD date string.
 *
 * Returns `dayStart` as midnight UTC of that date and `dayEnd` as midnight UTC
 * of the following date, suitable for half-open range queries (`gte` / `lt`).
 */
function dayBoundariesUTC(dateKey: string): { dayStart: Date; dayEnd: Date } {
  const dayStart = new Date(dateKey + 'T00:00:00.000Z');
  const dayEnd = new Date(dateKey + 'T00:00:00.000Z');
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  return { dayStart, dayEnd };
}

/**
 * Compute day boundaries for a given YYYY-MM-DD date string in the specified
 * IANA timezone (e.g. "Asia/Ulaanbaatar"). Falls back to UTC when no timezone
 * is provided.
 *
 * This ensures that queries like "show me today's meals" use the user's local
 * midnight rather than UTC midnight, so meals never roll over to the wrong day.
 */
export function dayBoundaries(dateKey: string, tz?: string): { dayStart: Date; dayEnd: Date } {
  if (!tz) return dayBoundariesUTC(dateKey);
  return {
    dayStart: midnightInTZ(dateKey, tz),
    dayEnd: midnightInTZ(nextDateKey(dateKey), tz),
  };
}

/**
 * Format a Date as YYYY-MM-DD in the user's local timezone (no Intl needed on
 * the client — uses JS Date local methods).
 */
export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format a UTC Date as YYYY-MM-DD in a given IANA timezone.
 * Falls back to UTC extraction when no timezone is given.
 */
export function toDateKeyInTZ(date: Date, tz?: string): string {
  if (!tz) return date.toISOString().split('T')[0]!;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function nextDateKey(dateKey: string): string {
  // Use noon UTC to avoid any DST edge case when incrementing the day
  const d = new Date(dateKey + 'T12:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split('T')[0]!;
}

/**
 * Return the UTC Date representing midnight on `dateKey` in IANA timezone `tz`.
 *
 * Strategy: start from UTC midnight of `dateKey`, determine what local time
 * that corresponds to in `tz`, then shift by the offset. Re-verify in case the
 * offset itself changed (DST transition).
 */
function midnightInTZ(dateKey: string, tz: string): Date {
  const utcMidnight = new Date(dateKey + 'T00:00:00.000Z');
  const offsetMs = tzOffsetMs(utcMidnight, tz);
  const candidate = new Date(utcMidnight.getTime() - offsetMs);

  // Re-verify offset at the candidate time (may differ due to DST)
  const verifyMs = tzOffsetMs(candidate, tz);
  if (verifyMs !== offsetMs) {
    return new Date(utcMidnight.getTime() - verifyMs);
  }
  return candidate;
}

/**
 * Return the signed offset in milliseconds between the local wall-clock time
 * in `tz` and UTC at the given instant. Positive = east of UTC.
 *
 * Example: Asia/Ulaanbaatar (UTC+8) → +28_800_000
 */
function tzOffsetMs(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => {
    const val = parts.find((p) => p.type === type)?.value ?? '0';
    return parseInt(val, 10);
  };

  let hour = get('hour');
  if (hour === 24) hour = 0; // some ICU locales format midnight as 24

  const localAsUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    hour,
    get('minute'),
    get('second'),
  );
  return localAsUtc - date.getTime();
}
