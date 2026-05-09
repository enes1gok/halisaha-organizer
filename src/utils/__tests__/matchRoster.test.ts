import { hasAssignedLineup } from '../matchRoster';

describe('hasAssignedLineup', () => {
  it('returns false when both teams empty', () => {
    expect(hasAssignedLineup({ teamAIds: [], teamBIds: [] })).toBe(false);
  });

  it('returns true when either team has players', () => {
    expect(hasAssignedLineup({ teamAIds: ['a'], teamBIds: [] })).toBe(true);
    expect(hasAssignedLineup({ teamAIds: [], teamBIds: ['b'] })).toBe(true);
  });
});
