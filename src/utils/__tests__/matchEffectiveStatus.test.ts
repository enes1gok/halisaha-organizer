import { getEffectiveStatus } from '../matchEffectiveStatus';

const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();

describe('getEffectiveStatus', () => {
  it('returns upcoming when startsAt is in the future', () => {
    expect(getEffectiveStatus({ status: 'upcoming', startsAt: future })).toBe('upcoming');
  });

  it('returns ongoing when upcoming but startsAt has passed', () => {
    expect(getEffectiveStatus({ status: 'upcoming', startsAt: past })).toBe('ongoing');
  });

  it('returns finished regardless of startsAt', () => {
    expect(getEffectiveStatus({ status: 'finished', startsAt: past })).toBe('finished');
    expect(getEffectiveStatus({ status: 'finished', startsAt: future })).toBe('finished');
  });

  it('returns cancelled regardless of startsAt', () => {
    expect(getEffectiveStatus({ status: 'cancelled', startsAt: past })).toBe('cancelled');
    expect(getEffectiveStatus({ status: 'cancelled', startsAt: future })).toBe('cancelled');
  });

  it('uses provided nowMs instead of Date.now()', () => {
    const startsAt = new Date(1_000_000).toISOString();
    expect(getEffectiveStatus({ status: 'upcoming', startsAt }, 999_999)).toBe('upcoming');
    expect(getEffectiveStatus({ status: 'upcoming', startsAt }, 1_000_000)).toBe('ongoing');
    expect(getEffectiveStatus({ status: 'upcoming', startsAt }, 1_000_001)).toBe('ongoing');
  });
});
