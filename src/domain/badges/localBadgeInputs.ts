import type { Match, Player } from '../../types/domain';
import { getMatchContribution } from '../../utils/matchPlayerContribution';
import { getPlayerMatchOutcome } from '../../utils/matchOutcome';
import type { PlayerBadgeInputs } from './types';

/** Çevrimdışı / yerel maç listesi ile sunucu `PlayerBadgeInputs` ile aynı şekli üretir. */
export function computeLocalBadgeInputs(player: Player, matches: Match[]): PlayerBadgeInputs {
  const finished = matches.filter((m) => m.status === 'finished' && m.result);
  let goals = 0;
  let assists = 0;
  let played = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let maxGoals = 0;
  let maxAssists = 0;

  for (const m of finished) {
    const onField =
      m.teamAIds.includes(player.id) || m.teamBIds.includes(player.id);
    if (!onField) continue;
    played += 1;
    const o = getPlayerMatchOutcome(m, player.id);
    if (o === 'W') wins += 1;
    else if (o === 'D') draws += 1;
    else if (o === 'L') losses += 1;

    const { goals: g, assists: a } = getMatchContribution(m, player.id);
    goals += g;
    assists += a;
    if (g > maxGoals) maxGoals = g;
    if (a > maxAssists) maxAssists = a;
  }

  const sorted = [...finished].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
  let goalMatchStreakCurrent = 0;
  let goalMatchStreakBest = 0;
  for (const m of sorted) {
    const onField =
      m.teamAIds.includes(player.id) || m.teamBIds.includes(player.id);
    if (!onField) continue;
    const g = getMatchContribution(m, player.id).goals;
    if (g >= 1) {
      goalMatchStreakCurrent += 1;
      if (goalMatchStreakCurrent > goalMatchStreakBest) goalMatchStreakBest = goalMatchStreakCurrent;
    } else {
      goalMatchStreakCurrent = 0;
    }
  }

  const stats = player.stats;
  const avg = stats.ratingAverage100 ?? null;
  const votes = stats.ratingVoteCount ?? 0;

  return {
    careerGoals: goals,
    careerAssists: assists,
    finishedMatchesPlayed: played,
    wins,
    draws,
    losses,
    motmCount: stats.motmCount ?? 0,
    goalMatchStreakCurrent,
    goalMatchStreakBest,
    avgPeerRating100: avg,
    peerRatingVoteCount: votes,
    maxGoalsSingleMatch: maxGoals,
    maxAssistsSingleMatch: maxAssists,
  };
}
