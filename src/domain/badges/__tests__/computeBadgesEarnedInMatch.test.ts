import { computeBadgesEarnedInMatch } from '../computeBadgesEarnedInMatch';
import type { PlayerBadgeInputs } from '../types';

function inputs(overrides: Partial<PlayerBadgeInputs> = {}): PlayerBadgeInputs {
  return {
    careerGoals: 0,
    careerAssists: 0,
    finishedMatchesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    motmCount: 0,
    goalMatchStreakCurrent: 0,
    goalMatchStreakBest: 0,
    avgPeerRating100: null,
    peerRatingVoteCount: 0,
    maxGoalsSingleMatch: 0,
    maxAssistsSingleMatch: 0,
    ...overrides,
  };
}

describe('computeBadgesEarnedInMatch', () => {
  it('returns empty array when player did not play', () => {
    const result = computeBadgesEarnedInMatch(inputs({ careerGoals: 10 }), {
      goals: 0,
      assists: 0,
      wonMotm: false,
      played: false,
      won: false,
    });
    expect(result).toHaveLength(0);
  });

  it('detects newly earned career goal badge (10 goals threshold)', () => {
    const result = computeBadgesEarnedInMatch(
      inputs({ careerGoals: 10 }),
      { goals: 1, assists: 0, wonMotm: false, played: true, won: false },
    );
    const ids = result.map((b) => b.id);
    expect(ids).toContain('goals_10');
  });

  it('does not flag badge already earned before this match', () => {
    const result = computeBadgesEarnedInMatch(
      inputs({ careerGoals: 15 }),
      { goals: 1, assists: 0, wonMotm: false, played: true, won: false },
    );
    // Was already at 14 before (15-1), which is still above 10 threshold
    const ids = result.map((b) => b.id);
    expect(ids).not.toContain('goals_10');
  });

  it('returns empty when no threshold crossed', () => {
    const result = computeBadgesEarnedInMatch(
      inputs({ careerGoals: 3 }),
      { goals: 1, assists: 0, wonMotm: false, played: true, won: false },
    );
    expect(result).toHaveLength(0);
  });
});
