import type { Match } from '../types/domain';

export function getMatchContribution(
  match: Match,
  playerId: string,
): { goals: number; assists: number } {
  const r = match.result;
  if (!r) return { goals: 0, assists: 0 };
  const goals = r.scorers.find((s) => s.playerId === playerId)?.count ?? 0;
  const assists = r.assists.find((s) => s.playerId === playerId)?.count ?? 0;
  return { goals, assists };
}

/**
 * Gol sayısı (azalan), asist (azalan), sonra görünen isim (tr sıralaması).
 */
export function sortPeersByMatchContribution<T extends { id: string }>(
  match: Match,
  items: T[],
  getDisplayName: (item: T) => string,
): T[] {
  return [...items].sort((a, b) => {
    const ca = getMatchContribution(match, a.id);
    const cb = getMatchContribution(match, b.id);
    if (cb.goals !== ca.goals) return cb.goals - ca.goals;
    if (cb.assists !== ca.assists) return cb.assists - ca.assists;
    return getDisplayName(a).localeCompare(getDisplayName(b), 'tr');
  });
}
