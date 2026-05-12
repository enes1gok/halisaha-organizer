import { computeEarnedBadges } from './computeBadgeViewModel';
import type { BadgeTileVm, PlayerBadgeInputs } from './types';

type MatchContrib = {
  goals: number;
  assists: number;
  /** Oyuncu bu maçta MOTM olarak seçildi mi? */
  wonMotm: boolean;
  /** Oyuncu bu maçta oynadı mı? */
  played: boolean;
  /** Oyuncu bu maçı kazandı mı? */
  won: boolean;
};

/**
 * Bu maçta yeni kazanılan badge'leri döner (öncesi=false, sonrası=true).
 * Seri ve max-single-match alanları için yaklaşık diff kullanılır.
 */
export function computeBadgesEarnedInMatch(
  currentInputs: PlayerBadgeInputs,
  contrib: MatchContrib,
): BadgeTileVm[] {
  if (!contrib.played) return [];

  const beforeInputs: PlayerBadgeInputs = {
    careerGoals: Math.max(0, currentInputs.careerGoals - contrib.goals),
    careerAssists: Math.max(0, currentInputs.careerAssists - contrib.assists),
    finishedMatchesPlayed: Math.max(0, currentInputs.finishedMatchesPlayed - 1),
    wins: Math.max(0, currentInputs.wins - (contrib.won ? 1 : 0)),
    draws: currentInputs.draws,
    losses: currentInputs.losses,
    motmCount: Math.max(0, currentInputs.motmCount - (contrib.wonMotm ? 1 : 0)),
    // Streak: maçta gol varsa bir önceki streak bir eksikti (yaklaşım)
    goalMatchStreakCurrent:
      contrib.goals > 0
        ? Math.max(0, currentInputs.goalMatchStreakCurrent - 1)
        : currentInputs.goalMatchStreakCurrent,
    goalMatchStreakBest:
      contrib.goals > 0 && currentInputs.goalMatchStreakCurrent >= currentInputs.goalMatchStreakBest
        ? Math.max(0, currentInputs.goalMatchStreakBest - 1)
        : currentInputs.goalMatchStreakBest,
    avgPeerRating100: currentInputs.avgPeerRating100,
    peerRatingVoteCount: currentInputs.peerRatingVoteCount,
    maxGoalsSingleMatch: currentInputs.maxGoalsSingleMatch,
    maxAssistsSingleMatch: currentInputs.maxAssistsSingleMatch,
  };

  const before = new Set(computeEarnedBadges(beforeInputs).map((b) => b.id));
  const after = computeEarnedBadges(currentInputs);

  return after.filter((b) => !before.has(b.id));
}
