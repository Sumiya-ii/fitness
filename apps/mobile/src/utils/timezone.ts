/**
 * Return the device's IANA timezone string (e.g. "Asia/Ulaanbaatar").
 * Used to send `tz` query params so the API computes day boundaries
 * in the user's local timezone.
 */
export function getDeviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
