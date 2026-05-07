import {
  endOfMonth,
  endOfWeek,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { tr } from 'date-fns/locale';
import type { Match, Player } from '../types/domain';

export type LeaderMetric = 'goals' | 'assists' | 'winRate' | 'matches';
export type Timeframe = 'all' | 'month' | 'week';

const weekStartsOnMonday = 1;

export function timeframeLabel(tf: Timeframe): string {
  switch (tf) {
    case 'all':
      return 'Tüm Zamanlar';
    case 'month':
      return 'Bu Ay';
    case 'week':
      return 'Bu Hafta';
    default:
      return tf;
  }
}

export function metricLabel(m: LeaderMetric): string {
  switch (m) {
    case 'goals':
      return 'Goller';
    case 'assists':
      return 'Asistler';
    case 'winRate':
      return 'Galibiyet %';
    case 'matches':
      return 'Maçlar';
    default:
      return m;
  }
}

function filterMatchesByTimeframe(matches: Match[], tf: Timeframe, ref: Date): Match[] {
  const finished = matches.filter((m) => m.status === 'finished');
  if (tf === 'all') return finished;

  const weekStart = startOfWeek(ref, { weekStartsOn: weekStartsOnMonday });
  const weekEnd = endOfWeek(ref, { weekStartsOn: weekStartsOnMonday });
  const monthStart = startOfMonth(ref);
  const monthEnd = endOfMonth(ref);

  return finished.filter((m) => {
    const d = new Date(m.startsAt);
    if (tf === 'week') return isWithinInterval(d, { start: weekStart, end: weekEnd });
    return isWithinInterval(d, { start: monthStart, end: monthEnd });
  });
}

function filterMatchesByGroup(matches: Match[], groupId?: string): Match[] {
  if (!groupId) return matches;
  return matches.filter((m) => m.groupId === groupId);
}

function aggregateForMatches(
  players: Player[],
  scoped: Match[],
  metric: LeaderMetric,
): { playerId: string; value: number }[] {
  const map = new Map<string, number>();

  for (const p of players) map.set(p.id, 0);

  if (metric === 'goals' || metric === 'assists') {
    for (const m of scoped) {
      const r = m.result;
      if (!r) continue;
      const lines = metric === 'goals' ? r.scorers : r.assists;
      for (const line of lines) {
        map.set(line.playerId, (map.get(line.playerId) ?? 0) + line.count);
      }
    }
  } else if (metric === 'matches') {
    for (const m of scoped) {
      const ids = new Set<string>();
      for (const pid of m.teamAIds) ids.add(pid);
      for (const pid of m.teamBIds) ids.add(pid);
      for (const pid of ids) map.set(pid, (map.get(pid) ?? 0) + 1);
    }
  } else {
    for (const p of players) {
      let wins = 0;
      let games = 0;
      for (const m of scoped) {
        const inA = m.teamAIds.includes(p.id);
        const inB = m.teamBIds.includes(p.id);
        if (!inA && !inB) continue;
        const r = m.result!;
        games++;
        const won =
          r.scoreA === r.scoreB
            ? false
            : (inA && r.scoreA > r.scoreB) || (inB && r.scoreB > r.scoreA);
        if (won) wins++;
      }
      map.set(p.id, games === 0 ? 0 : wins / games);
    }
  }

  return players.map((p) => ({ playerId: p.id, value: map.get(p.id) ?? 0 }));
}

export function buildLeaderboard(
  players: Player[],
  allMatches: Match[],
  metric: LeaderMetric,
  tf: Timeframe,
  ref: Date = new Date(),
  groupId?: string,
): { playerId: string; value: number; rank: number }[] {
  const scoped = filterMatchesByGroup(filterMatchesByTimeframe(allMatches, tf, ref), groupId);
  const rows = aggregateForMatches(players, scoped, metric);
  const filteredRows =
    metric === 'goals' || metric === 'assists' ? rows.filter((row) => row.value > 0) : rows;

  const sorted = [...filteredRows].sort((a, b) => b.value - a.value);
  const withRank = sorted.map((row, i) => ({
    ...row,
    rank: i + 1,
  }));
  return withRank;
}

export { tr };
