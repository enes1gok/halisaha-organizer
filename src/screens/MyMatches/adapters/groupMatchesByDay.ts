import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import { tr } from 'date-fns/locale';
import type { Match } from '../../../types/domain';

export type SegmentValue = 'upcoming' | 'past' | 'all';

export type AgendaSection = {
  /** Display title for the section header (e.g. "Bugün, 10 Mayıs"). */
  title: string;
  /** Optional secondary label like "1 maç" / "2 maç". */
  subtitle: string;
  /** `yyyy-MM-dd` key for stable identity and selection sync. */
  dateKey: string;
  /** Matches falling on this day, sorted ascending by `startsAt`. */
  data: Match[];
};

export type MonthDayCell = {
  date: Date;
  dateKey: string;
  isCurrentMonth: boolean;
  isToday: boolean;
};

const DAY_KEY_FMT = 'yyyy-MM-dd';

/** Local-timezone day key for a Match (`startsAt` ISO is interpreted in local TZ). */
export function dayKeyOf(date: Date): string {
  return format(date, DAY_KEY_FMT);
}

/** Map of `yyyy-MM-dd` → Match[] (ascending by `startsAt`). */
export function groupMatchesByDay(matches: readonly Match[]): Map<string, Match[]> {
  const map = new Map<string, Match[]>();
  for (const m of matches) {
    let day: Date;
    try {
      day = parseISO(m.startsAt);
      if (Number.isNaN(day.getTime())) continue;
    } catch {
      continue;
    }
    const key = dayKeyOf(day);
    const list = map.get(key);
    if (list) list.push(m);
    else map.set(key, [m]);
  }
  for (const list of map.values()) {
    list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }
  return map;
}

/** Apply the segment filter against `today` (today bucket counts as "upcoming"). */
export function filterMatchesBySegment(
  matches: readonly Match[],
  segment: SegmentValue,
  today: Date,
): Match[] {
  if (segment === 'all') return [...matches];
  const todayStart = startOfDay(today).getTime();
  return matches.filter((m) => {
    const t = new Date(m.startsAt).getTime();
    if (Number.isNaN(t)) return false;
    if (segment === 'upcoming') return t >= todayStart;
    return t < todayStart;
  });
}

/** Turkish day header copy: "Bugün, 10 Mayıs" / "Yarın, 11 Mayıs" / "Cumartesi, 15 Mayıs". */
export function formatDayHeader(dateKey: string, today: Date): string {
  const day = parseDateKey(dateKey);
  if (!day) return dateKey;
  const diff = differenceInCalendarDays(day, startOfDay(today));
  const dayMonth = format(day, 'd MMMM', { locale: tr });
  if (diff === 0) return `Bugün, ${dayMonth}`;
  if (diff === 1) return `Yarın, ${dayMonth}`;
  if (diff === -1) return `Dün, ${dayMonth}`;
  const weekday = format(day, 'EEEE', { locale: tr });
  return `${capitalize(weekday)}, ${dayMonth}`;
}

/** "1 maç" / "5 maç" — Turkish numbers do not pluralize the noun. */
export function formatMatchCount(count: number): string {
  return `${count} maç`;
}

/**
 * Build agenda sections (chronologically sorted) for the segment.
 * - `upcoming` → ascending (today first).
 * - `past`     → descending (most recent first).
 * - `all`      → ascending.
 */
export function buildAgendaSections(
  matches: readonly Match[],
  segment: SegmentValue,
  today: Date,
): AgendaSection[] {
  const filtered = filterMatchesBySegment(matches, segment, today);
  const grouped = groupMatchesByDay(filtered);
  const keys = Array.from(grouped.keys());
  keys.sort((a, b) => (segment === 'past' ? b.localeCompare(a) : a.localeCompare(b)));
  return keys.map((dateKey) => {
    const data = grouped.get(dateKey) ?? [];
    return {
      dateKey,
      title: formatDayHeader(dateKey, today),
      subtitle: formatMatchCount(data.length),
      data,
    };
  });
}

/**
 * 6×7 month matrix anchored at `monthAnchor`, week starts Monday (ISO).
 * Cells outside the anchor month carry `isCurrentMonth: false`.
 */
export function buildMonthMatrix(monthAnchor: Date, today: Date): MonthDayCell[][] {
  const monthStart = startOfMonth(monthAnchor);
  const offset = (monthStart.getDay() + 6) % 7;
  const gridStart = startOfDay(addDays(monthStart, -offset));
  const rows: MonthDayCell[][] = [];
  for (let row = 0; row < 6; row += 1) {
    const cells: MonthDayCell[] = [];
    for (let col = 0; col < 7; col += 1) {
      const date = addDays(gridStart, row * 7 + col);
      cells.push({
        date,
        dateKey: dayKeyOf(date),
        isCurrentMonth: date.getMonth() === monthStart.getMonth(),
        isToday: isSameDay(date, today),
      });
    }
    rows.push(cells);
  }
  return rows;
}

/** Title for the calendar header — "Mayıs 2026" (TR). */
export function formatMonthTitle(monthAnchor: Date): string {
  return capitalize(format(monthAnchor, 'LLLL yyyy', { locale: tr }));
}

/** Move month anchor by `delta` (kept anchored at first of month). */
export function shiftMonth(monthAnchor: Date, delta: number): Date {
  return startOfMonth(addMonths(monthAnchor, delta));
}

/** Verbose accessibility label: "9 Mayıs Pazartesi, 1 maç". */
export function describeDayForA11y(dateKey: string, count: number): string {
  const day = parseDateKey(dateKey);
  if (!day) return dateKey;
  const dayMonth = format(day, 'd MMMM', { locale: tr });
  const weekday = capitalize(format(day, 'EEEE', { locale: tr }));
  return count > 0
    ? `${dayMonth} ${weekday}, ${formatMatchCount(count)}`
    : `${dayMonth} ${weekday}, maç yok`;
}

function parseDateKey(key: string): Date | null {
  const parts = key.split('-');
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map((p) => Number.parseInt(p, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m - 1, d);
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toLocaleUpperCase('tr-TR') + value.slice(1);
}
