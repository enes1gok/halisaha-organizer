import type { Match, Player } from '../types/domain';
import { getPlayerMatchOutcome } from './matchOutcome';

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
      const outcome = getPlayerMatchOutcome(m, pid);
      if (!outcome) continue;
      s.matchesPlayed += 1;
      if (outcome === 'D') s.draws += 1;
      else if (outcome === 'W') s.wins += 1;
      else s.losses += 1;
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

/** Tek bitmiş maçın bir oyuncuya maç-türevi katkısı; `recomputePlayerStatsFromMatches` ile aynı kurallar. */
export function matchStatContributionForPlayer(m: Match, playerId: string): {
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  goals: number;
  assists: number;
} {
  const z = {
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    goals: 0,
    assists: 0,
  };
  if (m.status !== 'finished' || !m.result) return z;
  const r = m.result;
  for (const line of r.scorers) {
    if (line.playerId === playerId) z.goals += line.count;
  }
  for (const line of r.assists) {
    if (line.playerId === playerId) z.assists += line.count;
  }
  const outcome = getPlayerMatchOutcome(m, playerId);
  if (!outcome) return z;
  z.matchesPlayed = 1;
  if (outcome === 'W') z.wins = 1;
  else if (outcome === 'L') z.losses = 1;
  else z.draws = 1;
  return z;
}

function affectedPlayerIdsForStatsMatch(m: Match): Set<string> {
  const ids = new Set<string>();
  if (m.status !== 'finished' || !m.result) return ids;
  for (const id of m.teamAIds) ids.add(id);
  for (const id of m.teamBIds) ids.add(id);
  for (const line of m.result.scorers) ids.add(line.playerId);
  for (const line of m.result.assists) ids.add(line.playerId);
  return ids;
}

/**
 * Tek maçın önceki ve yeni haline göre oyuncu maç-türevi istatistiklerini günceller.
 * Rating / MOTM alanlarına dokunmaz.
 */
export function patchPlayersStatsForMatchTransition(
  players: Player[],
  prevMatch: Match | undefined,
  nextMatch: Match | undefined,
): Player[] {
  const ids = new Set<string>();
  if (prevMatch?.status === 'finished' && prevMatch.result) {
    for (const id of affectedPlayerIdsForStatsMatch(prevMatch)) ids.add(id);
  }
  if (nextMatch?.status === 'finished' && nextMatch.result) {
    for (const id of affectedPlayerIdsForStatsMatch(nextMatch)) ids.add(id);
  }

  const applyDelta = (
    stats: Player['stats'],
    delta: ReturnType<typeof matchStatContributionForPlayer>,
    sign: 1 | -1,
  ): Player['stats'] => ({
    ...stats,
    matchesPlayed: stats.matchesPlayed + sign * delta.matchesPlayed,
    wins: stats.wins + sign * delta.wins,
    losses: stats.losses + sign * delta.losses,
    draws: stats.draws + sign * delta.draws,
    goals: stats.goals + sign * delta.goals,
    assists: stats.assists + sign * delta.assists,
  });

  return players.map((p) => {
    if (!ids.has(p.id)) return p;
    let stats = p.stats;
    if (prevMatch?.status === 'finished' && prevMatch.result) {
      stats = applyDelta(stats, matchStatContributionForPlayer(prevMatch, p.id), -1);
    }
    if (nextMatch?.status === 'finished' && nextMatch.result) {
      stats = applyDelta(stats, matchStatContributionForPlayer(nextMatch, p.id), 1);
    }
    return { ...p, stats };
  });
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

/** İlerleme çubuğu: mevcut seviye bandı içinde 0–1 (üst eşikte 1). */
export function playerScoreTierProgress01(score: number): number {
  if (score <= 20) return Math.min(1, score / 20);
  if (score <= 50) return Math.min(1, (score - 20) / 30);
  if (score <= 100) return Math.min(1, (score - 50) / 50);
  return 1;
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
    const outcome = getPlayerMatchOutcome(m, playerId);
    if (!outcome) continue;
    if (outcome === 'W') streak++;
    else break;
  }
  return streak;
}
