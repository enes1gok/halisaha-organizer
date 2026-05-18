/**
 * Quiet-hour bounds are stored as local clock strings "HH:MM" (see notificationPreferences).
 */

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** Parses "HH:MM" into a Date on `base` calendar day (time zone local). Invalid → fallback base. */
export function parseQuietHourToDate(hhmm: string, base: Date = new Date()): Date {
  const m = HHMM.exec(hhmm.trim());
  const d = new Date(base);
  if (!m || m[1] === undefined || m[2] === undefined) return d;
  d.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
  return d;
}

export function formatDateToQuietHour(d: Date): string {
  const h = d.getHours();
  const min = d.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
