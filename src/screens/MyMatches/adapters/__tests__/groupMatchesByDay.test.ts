import type { Match } from '../../../../types/domain';
import {
  buildAgendaSections,
  buildMonthMatrix,
  countMatchesBySegment,
  describeDayForA11y,
  filterMatchesBySegment,
  formatDayHeader,
  formatMatchCount,
  formatMonthTitle,
  groupMatchesByDay,
  shiftMonth,
} from '../groupMatchesByDay';

function mkMatch(id: string, startsAt: string, partial: Partial<Match> = {}): Match {
  const base: Match = {
    id,
    startsAt,
    venue: 'Saha',
    organizerId: 'org',
    maxPlayers: 14,
    paymentMethod: 'iban',
    joinCode: 'ABC',
    attendees: [],
    teamAIds: [],
    teamBIds: [],
    lineupLocked: false,
    selfReportEnabled: false,
    status: 'upcoming',
    selfReports: [],
  };
  return { ...base, ...partial };
}

const today = new Date(2026, 4, 10, 12, 0, 0);

describe('groupMatchesByDay', () => {
  it('groups matches by local-day key sorted by start time', () => {
    const m1 = mkMatch('m1', new Date(2026, 4, 10, 18, 0, 0).toISOString());
    const m2 = mkMatch('m2', new Date(2026, 4, 10, 21, 0, 0).toISOString());
    const m3 = mkMatch('m3', new Date(2026, 4, 12, 10, 0, 0).toISOString());

    const result = groupMatchesByDay([m2, m3, m1]);

    expect(Array.from(result.keys()).sort()).toEqual(['2026-05-10', '2026-05-12']);
    expect(result.get('2026-05-10')!.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(result.get('2026-05-12')!.map((m) => m.id)).toEqual(['m3']);
  });

  it('skips matches with invalid startsAt', () => {
    const valid = mkMatch('m1', new Date(2026, 4, 10, 18, 0, 0).toISOString());
    const invalid = mkMatch('bad', 'not-a-date');
    const result = groupMatchesByDay([valid, invalid]);
    expect(Array.from(result.keys())).toEqual(['2026-05-10']);
  });
});

describe('countMatchesBySegment', () => {
  const past = mkMatch('p', new Date(2026, 4, 1, 18, 0, 0).toISOString());
  const todayMatch = mkMatch('t', new Date(2026, 4, 10, 21, 0, 0).toISOString());
  const future = mkMatch('f', new Date(2026, 4, 20, 18, 0, 0).toISOString());

  it('returns totals per segment for the match pool', () => {
    expect(countMatchesBySegment([past, todayMatch, future], today)).toEqual({
      upcoming: 2,
      past: 1,
      all: 3,
    });
  });

  it('matches empty pool', () => {
    expect(countMatchesBySegment([], today)).toEqual({
      upcoming: 0,
      past: 0,
      all: 0,
    });
  });
});

describe('filterMatchesBySegment', () => {
  const past = mkMatch('p', new Date(2026, 4, 1, 18, 0, 0).toISOString());
  const todayMatch = mkMatch('t', new Date(2026, 4, 10, 21, 0, 0).toISOString());
  const future = mkMatch('f', new Date(2026, 4, 20, 18, 0, 0).toISOString());

  it('upcoming includes today and future', () => {
    const out = filterMatchesBySegment([past, todayMatch, future], 'upcoming', today);
    expect(out.map((m) => m.id).sort()).toEqual(['f', 't']);
  });

  it('past excludes today and includes only earlier days', () => {
    const out = filterMatchesBySegment([past, todayMatch, future], 'past', today);
    expect(out.map((m) => m.id)).toEqual(['p']);
  });

  it('all returns everything', () => {
    const out = filterMatchesBySegment([past, todayMatch, future], 'all', today);
    expect(out.map((m) => m.id).sort()).toEqual(['f', 'p', 't']);
  });
});

describe('formatDayHeader', () => {
  it('uses Bugün / Yarın / Dün for adjacent days', () => {
    expect(formatDayHeader('2026-05-10', today)).toBe('Bugün, 10 Mayıs');
    expect(formatDayHeader('2026-05-11', today)).toBe('Yarın, 11 Mayıs');
    expect(formatDayHeader('2026-05-09', today)).toBe('Dün, 9 Mayıs');
  });

  it('uses capitalized Turkish weekday for other days', () => {
    expect(formatDayHeader('2026-05-15', today)).toBe('Cuma, 15 Mayıs');
    expect(formatDayHeader('2026-05-17', today)).toBe('Pazar, 17 Mayıs');
  });
});

describe('formatMatchCount', () => {
  it('returns Turkish singular form for any count', () => {
    expect(formatMatchCount(1)).toBe('1 maç');
    expect(formatMatchCount(5)).toBe('5 maç');
  });
});

describe('buildAgendaSections', () => {
  const past = mkMatch('p', new Date(2026, 4, 1, 18, 0, 0).toISOString());
  const todayA = mkMatch('ta', new Date(2026, 4, 10, 18, 0, 0).toISOString());
  const todayB = mkMatch('tb', new Date(2026, 4, 10, 21, 0, 0).toISOString());
  const future = mkMatch('f', new Date(2026, 4, 20, 18, 0, 0).toISOString());

  it('upcoming sections sorted ascending', () => {
    const sections = buildAgendaSections([past, todayA, todayB, future], 'upcoming', today);
    expect(sections.map((s) => s.dateKey)).toEqual(['2026-05-10', '2026-05-20']);
    expect(sections[0].subtitle).toBe('2 maç');
    expect(sections[0].data.map((m) => m.id)).toEqual(['ta', 'tb']);
  });

  it('past sections sorted descending', () => {
    const olderPast = mkMatch('older', new Date(2026, 3, 25, 18, 0, 0).toISOString());
    const sections = buildAgendaSections([past, olderPast, todayA], 'past', today);
    expect(sections.map((s) => s.dateKey)).toEqual(['2026-05-01', '2026-04-25']);
  });

  it('all sections sorted ascending', () => {
    const sections = buildAgendaSections([future, past, todayA], 'all', today);
    expect(sections.map((s) => s.dateKey)).toEqual(['2026-05-01', '2026-05-10', '2026-05-20']);
  });

  it('returns empty array when nothing matches segment', () => {
    expect(buildAgendaSections([past], 'upcoming', today)).toEqual([]);
  });
});

describe('buildMonthMatrix', () => {
  it('produces 6 rows of 7 cells starting Monday', () => {
    const matrix = buildMonthMatrix(new Date(2026, 4, 1), today);
    expect(matrix).toHaveLength(6);
    matrix.forEach((row) => expect(row).toHaveLength(7));
    matrix.forEach((row) => row.forEach((cell) => expect(cell.date.getDay()).toBeDefined()));
    expect(matrix[0][0].date.getDay()).toBe(1);
  });

  it('marks current month and today', () => {
    const matrix = buildMonthMatrix(new Date(2026, 4, 1), today);
    const flat = matrix.flat();
    const currentMonthCells = flat.filter((c) => c.isCurrentMonth);
    expect(currentMonthCells).toHaveLength(31);
    expect(flat.find((c) => c.isToday)?.dateKey).toBe('2026-05-10');
  });
});

describe('formatMonthTitle', () => {
  it('returns capitalized Turkish month title', () => {
    expect(formatMonthTitle(new Date(2026, 4, 1))).toBe('Mayıs 2026');
    expect(formatMonthTitle(new Date(2026, 0, 1))).toBe('Ocak 2026');
  });
});

describe('shiftMonth', () => {
  it('shifts by delta and anchors to first day', () => {
    const next = shiftMonth(new Date(2026, 4, 15), 1);
    expect(next.getMonth()).toBe(5);
    expect(next.getDate()).toBe(1);
    const prev = shiftMonth(new Date(2026, 0, 31), -1);
    expect(prev.getMonth()).toBe(11);
    expect(prev.getFullYear()).toBe(2025);
  });
});

describe('describeDayForA11y', () => {
  it('includes match count when > 0', () => {
    expect(describeDayForA11y('2026-05-10', 2)).toBe('10 Mayıs Pazar, 2 maç');
  });

  it('uses fallback copy when count is 0', () => {
    expect(describeDayForA11y('2026-05-09', 0)).toBe('9 Mayıs Cumartesi, maç yok');
  });
});
