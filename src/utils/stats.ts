import type { Match, Player } from '../types/domain';

export function recomputePlayerStatsFromMatches(
  players: Player[],
  matches: Match[],
): Player[] {
  const statsMap = new Map(
    players.map((p) => [
      p.id,
      {
        matchesPlayed: 0,
        goals: 0,
        assists: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        ratingAverage100: p.stats.ratingAverage100,
        ratingVoteCount: p.stats.ratingVoteCount ?? 0,
        motmCount: p.stats.motmCount ?? 0,
      },
    ]),
  );

  for (const m of matches) {
    if (m.status !== 'finished' || !m.result) continue;
    const r = m.result;
    const seen = new Set<string>();

    for (const pid of m.teamAIds) seen.add(pid);
    for (const pid of m.teamBIds) seen.add(pid);

    for (const pid of seen) {
      const s = statsMap.get(pid);
      if (!s) continue;
      s.matchesPlayed += 1;

      const inA = m.teamAIds.includes(pid);
      if (r.scoreA === r.scoreB) s.draws += 1;
      else if (inA)
        r.scoreA > r.scoreB ? (s.wins += 1) : (s.losses += 1);
      else r.scoreB > r.scoreA ? (s.wins += 1) : (s.losses += 1);
    }

    for (const line of r.scorers) {
      const s = statsMap.get(line.playerId);
      if (s) s.goals += line.count;
    }
    for (const line of r.assists) {
      const s = statsMap.get(line.playerId);
      if (s) s.assists += line.count;
    }
  }

  return players.map((p) => ({
    ...p,
    stats: statsMap.get(p.id) ?? { ...emptyStats },
  }));
}

const emptyStats = {
  matchesPlayed: 0,
  goals: 0,
  assists: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  ratingAverage100: undefined,
  ratingVoteCount: 0,
  motmCount: 0,
};

const LEVELS = [
  { max: 20, label: 'Amatör' },
  { max: 50, label: 'Rutin' },
  { max: 100, label: 'İyi' },
  { max: Infinity, label: 'Efsane' },
] as const;

export function playerScore(p: Player): number {
  const { goals, assists, wins, ratingAverage100, motmCount } = p.stats;
  const ratingBonus = ratingAverage100 ? Math.round(ratingAverage100 / 20) : 0;
  return goals * 2 + assists + wins + (motmCount ?? 0) + ratingBonus;
}

export function levelLabelFromScore(score: number): string {
  for (const L of LEVELS) {
    if (score <= L.max) return L.label;
  }
  return 'Efsane';
}

export function winRate(stats: Player['stats']): number {
  const { wins, losses, draws } = stats;
  const total = wins + losses + draws;
  if (total === 0) return 0;
  return wins / total;
}

/** Win streak: consecutive wins in chronological finished matches for player */
export function computeWinStreak(matches: Match[], playerId: string): number {
  const finished = matches
    .filter((m) => m.status === 'finished' && m.result)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  let streak = 0;
  for (const m of finished) {
    const r = m.result!;
    const inA = m.teamAIds.includes(playerId);
    const inB = m.teamBIds.includes(playerId);
    if (!inA && !inB) continue;
    const scoreA = r.scoreA;
    const scoreB = r.scoreB;
    let outcome: 'W' | 'L' | 'D';
    if (scoreA === scoreB) outcome = 'D';
    else if (inA) outcome = scoreA > scoreB ? 'W' : 'L';
    else outcome = scoreB > scoreA ? 'W' : 'L';

    if (outcome === 'W') streak++;
    else break;
  }
  return streak;
}
