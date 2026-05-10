import { computeBadgeTiles, computeEarnedBadges } from '../computeBadgeViewModel';
import type { PlayerBadgeInputs } from '../types';

const zero = (): PlayerBadgeInputs => ({
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
});

describe('computeBadgeTiles', () => {
  it('marks motm_5 earned when motmCount >= 5', () => {
    const tiles = computeBadgeTiles({ ...zero(), motmCount: 5 });
    const m = tiles.find((t) => t.id === 'motm_5');
    expect(m?.earned).toBe(true);
    expect(m?.progress01).toBe(1);
  });

  it('uses goal streak current for streak badge progress', () => {
    const tiles = computeBadgeTiles({
      ...zero(),
      goalMatchStreakBest: 5,
      goalMatchStreakCurrent: 2,
    });
    const s = tiles.find((t) => t.id === 'streak_goals_5');
    expect(s?.earned).toBe(true);
    expect(s?.progress01).toBe(1);
  });

  it('requires votes for rating_star', () => {
    const none = computeBadgeTiles({ ...zero(), avgPeerRating100: 85, peerRatingVoteCount: 5 });
    expect(none.find((t) => t.id === 'rating_star')?.earned).toBe(false);
    const ok = computeBadgeTiles({ ...zero(), avgPeerRating100: 80, peerRatingVoteCount: 20 });
    expect(ok.find((t) => t.id === 'rating_star')?.earned).toBe(true);
  });
});

describe('computeEarnedBadges', () => {
  it('filters to earned only', () => {
    const earned = computeEarnedBadges({ ...zero(), careerGoals: 100 });
    expect(earned.map((e) => e.id)).toContain('goals_100');
    expect(earned.some((e) => e.id === 'goals_50')).toBe(true);
  });
});
