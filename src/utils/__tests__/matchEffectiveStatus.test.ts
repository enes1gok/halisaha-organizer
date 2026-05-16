import { getEffectiveStatus } from '../matchEffectiveStatus';

const MATCH_DURATION_MS = 60 * 60 * 1000;
const future = new Date(Date.now() + MATCH_DURATION_MS).toISOString();
const recentlyPast = new Date(Date.now() - 30 * 60 * 1000).toISOString();
const longPast = new Date(Date.now() - 120 * 60 * 1000).toISOString();

describe('getEffectiveStatus', () => {
  it('returns upcoming when startsAt is in the future', () => {
    expect(getEffectiveStatus({ status: 'upcoming', startsAt: future })).toBe('upcoming');
  });

  it('returns ongoing when upcoming but startsAt has passed (within 60 min)', () => {
    expect(getEffectiveStatus({ status: 'upcoming', startsAt: recentlyPast })).toBe('ongoing');
  });

  it('returns finished when startsAt + 60 min has passed', () => {
    expect(getEffectiveStatus({ status: 'upcoming', startsAt: longPast })).toBe('finished');
  });

  it('returns finished regardless of startsAt', () => {
    expect(getEffectiveStatus({ status: 'finished', startsAt: longPast })).toBe('finished');
    expect(getEffectiveStatus({ status: 'finished', startsAt: future })).toBe('finished');
  });

  it('returns cancelled regardless of startsAt', () => {
    expect(getEffectiveStatus({ status: 'cancelled', startsAt: longPast })).toBe('cancelled');
    expect(getEffectiveStatus({ status: 'cancelled', startsAt: future })).toBe('cancelled');
  });

  it('uses provided nowMs instead of Date.now()', () => {
    const startsAt = new Date(1_000_000).toISOString();
    expect(getEffectiveStatus({ status: 'upcoming', startsAt }, 999_999)).toBe('upcoming');
    expect(getEffectiveStatus({ status: 'upcoming', startsAt }, 1_000_000)).toBe('ongoing');
    expect(getEffectiveStatus({ status: 'upcoming', startsAt }, 1_000_000 + MATCH_DURATION_MS - 1)).toBe('ongoing');
    expect(getEffectiveStatus({ status: 'upcoming', startsAt }, 1_000_000 + MATCH_DURATION_MS)).toBe('finished');
  });
});
