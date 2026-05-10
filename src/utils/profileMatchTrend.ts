import type { Match } from '../types/domain';

export function matchOutcomeForPlayer(m: Match, userId: string): 'W' | 'L' | 'D' | null {
  if (m.status !== 'finished' || !m.result) return null;
  const r = m.result;
  const inA = m.teamAIds.includes(userId);
  const inB = m.teamBIds.includes(userId);
  if (r.scoreA === r.scoreB) return 'D';
  if (inA) return r.scoreA > r.scoreB ? 'W' : 'L';
  if (inB) return r.scoreB > r.scoreA ? 'W' : 'L';
  return 'D';
}

export function outcomeToTrendScore(o: 'W' | 'L' | 'D'): number {
  if (o === 'W') return 1;
  if (o === 'D') return 0.5;
  return 0;
}

/** Last `limit` finished matches, oldest → newest (for left‑to‑right sparkline). */
export function sparklineTrendScores(matches: Match[], userId: string, limit = 10): number[] {
  const finished = matches
    .filter((m) => m.status === 'finished' && m.result)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
    .slice(0, limit);

  const outcomes: ('W' | 'L' | 'D')[] = [];
  for (const m of finished) {
    const o = matchOutcomeForPlayer(m, userId);
    if (o) outcomes.push(o);
  }
  return outcomes.reverse().map(outcomeToTrendScore);
}
