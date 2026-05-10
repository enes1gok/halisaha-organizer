import {
  goalsTotalMatchesScore,
  scoreAndStatLinesConsistent,
  totalGoalsFromStatMap,
} from '../postMatchScoreValidation';

describe('totalGoalsFromStatMap', () => {
  it('returns 0 for empty map', () => {
    expect(totalGoalsFromStatMap({})).toBe(0);
  });

  it('sums positive counts only', () => {
    expect(
      totalGoalsFromStatMap({
        a: 3,
        b: 2,
      }),
    ).toBe(5);
  });

  it('ignores zero and negative values', () => {
    expect(
      totalGoalsFromStatMap({
        a: 2,
        b: 0,
        c: -1,
      }),
    ).toBe(2);
  });
});

describe('goalsTotalMatchesScore', () => {
  it('returns true when score sum equals goal list sum', () => {
    expect(goalsTotalMatchesScore(5, 3, { x: 5, y: 3 })).toBe(true);
    expect(goalsTotalMatchesScore(0, 0, {})).toBe(true);
  });

  it('returns false when totals differ', () => {
    expect(goalsTotalMatchesScore(5, 3, { x: 10 })).toBe(false);
  });
});

describe('scoreAndStatLinesConsistent', () => {
  const teamA = ['a1', 'a2'];
  const teamB = ['b1'];

  it('accepts plain goals without KK', () => {
    expect(
      scoreAndStatLinesConsistent(
        2,
        1,
        teamA,
        teamB,
        { a1: 2, b1: 1 },
        {},
      ),
    ).toBe(true);
  });

  it('attributes KK to opposing score', () => {
    expect(
      scoreAndStatLinesConsistent(
        2,
        1,
        teamA,
        teamB,
        { a1: 2 },
        { a2: 1 },
      ),
    ).toBe(true);
  });

  it('rejects goals on unassigned roster', () => {
    expect(
      scoreAndStatLinesConsistent(1, 0, teamA, teamB, { x: 1 }, {}),
    ).toBe(false);
  });
});
