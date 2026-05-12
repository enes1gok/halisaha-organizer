import { getEffectiveStatus } from '../../utils/matchEffectiveStatus';
import { isPastMatchEnd } from '../../utils/matchTiming';

// useEffectiveMatchStatus is built on getEffectiveStatus + isPastMatchEnd.
// We verify the core logic through those pure utilities since renderHook
// is not available without @testing-library/react-hooks.

describe('useEffectiveMatchStatus core logic (via getEffectiveStatus)', () => {
  it('returns upcoming when match has not started', () => {
    const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(getEffectiveStatus({ status: 'upcoming', startsAt })).toBe('upcoming');
  });

  it('returns ongoing immediately when startsAt has passed for upcoming match', () => {
    const startsAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(getEffectiveStatus({ status: 'upcoming', startsAt })).toBe('ongoing');
  });

  it('returns finished regardless of time', () => {
    const past = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(getEffectiveStatus({ status: 'finished', startsAt: past })).toBe('finished');
  });

  it('returns cancelled regardless of time', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(getEffectiveStatus({ status: 'cancelled', startsAt: future })).toBe('cancelled');
  });

  it('isPastMatchEnd returns false before match ends', () => {
    const startsAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    expect(isPastMatchEnd(startsAt)).toBe(false);
  });

  it('isPastMatchEnd returns true after 60min from startsAt', () => {
    const startsAt = new Date(Date.now() - 70 * 60 * 1000).toISOString();
    expect(isPastMatchEnd(startsAt)).toBe(true);
  });
});
