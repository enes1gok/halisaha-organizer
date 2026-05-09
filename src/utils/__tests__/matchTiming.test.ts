import { getMatchEndsAtIso, isPastMatchEnd, MATCH_DURATION_MINUTES } from '../matchTiming';

describe('matchTiming', () => {
  it('adds MATCH_DURATION_MINUTES to startsAt', () => {
    const start = '2026-05-10T11:27:00.000Z';
    const end = getMatchEndsAtIso(start);
    expect(new Date(end).getTime() - new Date(start).getTime()).toBe(MATCH_DURATION_MINUTES * 60 * 1000);
  });

  it('isPastMatchEnd is false before end', () => {
    const start = new Date(Date.now() + 3_600_000).toISOString();
    expect(isPastMatchEnd(start, Date.now())).toBe(false);
  });

  it('isPastMatchEnd is true after end', () => {
    const start = new Date(Date.now() - 3_600_000).toISOString();
    expect(isPastMatchEnd(start, Date.now())).toBe(true);
  });
});
