import type { Attendee, Match, Player } from '../types/domain';
import { isAppError, shouldRetry, toUserMessage } from '../services/supabase/errors';
import type { MatchGraphPayload } from '../services/supabase/matchGraph';
import type { ProfileRow, PublicProfileRow } from '../services/supabase/types';
import { isRemoteMatchId } from '../utils/matchId';
import { recomputePlayerStatsFromMatches } from '../utils/stats';

export function withSyncedStats(players: Player[], matches: Match[]): Player[] {
  return recomputePlayerStatsFromMatches(players, matches);
}

export function upsertAttendee(attendees: Attendee[], playerId: string, patch: Partial<Attendee>): Attendee[] {
  const idx = attendees.findIndex((a) => a.playerId === playerId);
  if (idx === -1) return [...attendees, { playerId, status: 'going', paid: false, ...patch }];
  const next = [...attendees];
  next[idx] = { ...next[idx], ...patch };
  return next;
}

export function mergeStatLines(
  lines: { playerId: string; count: number }[],
  playerId: string,
  delta: number,
) {
  const idx = lines.findIndex((l) => l.playerId === playerId);
  if (delta === 0) return lines;
  if (idx === -1) return [...lines, { playerId, count: delta }];
  const copy = [...lines];
  const next = copy[idx].count + delta;
  if (next <= 0) copy.splice(idx, 1);
  else copy[idx] = { ...copy[idx], count: next };
  return copy;
}

export function emptyPlayerStats(): Player['stats'] {
  return {
    matchesPlayed: 0,
    goals: 0,
    assists: 0,
    wins: 0,
    losses: 0,
    draws: 0,
  };
}

export function rethrowStoreActionError(action: string, error: unknown, fallbackMessage: string): never {
  if (isAppError(error)) {
    console.warn(`[store] ${action} failed`, {
      code: error.code,
      operation: error.operation,
      retryable: shouldRetry(error),
    });
    throw error;
  }
  throw new Error(toUserMessage(error, fallbackMessage));
}

export function upsertProfilesIntoPlayers(players: Player[], profiles: PublicProfileRow[] | ProfileRow[]): Player[] {
  let next = [...players];
  for (const pr of profiles) {
    const idx = next.findIndex((p) => p.id === pr.id);
    const stub: Player = {
      id: pr.id,
      name: pr.display_name.trim() || 'Oyuncu',
      photoUri: pr.photo_uri ?? undefined,
      position: pr.position,
      preferredFoot: pr.preferred_foot,
      iban: 'iban' in pr ? (pr.iban ?? undefined) : idx >= 0 ? next[idx].iban : undefined,
      stats: idx >= 0 ? next[idx].stats : emptyPlayerStats(),
    };
    if (idx >= 0) next[idx] = { ...next[idx], ...stub };
    else next.unshift(stub);
  }
  return next;
}

export function mergeRemoteGraph(
  state: { players: Player[]; matches: Match[] },
  graph: MatchGraphPayload,
): { players: Player[]; matches: Match[] } {
  const players = upsertProfilesIntoPlayers(state.players, graph.profiles);
  const others = state.matches.filter((m) => m.id !== graph.match.id);
  const mergedMatches = [graph.match, ...others];
  return {
    matches: mergedMatches,
    players: withSyncedStats(players, mergedMatches),
  };
}

export function mergeHydratedRemoteMatches(
  state: { players: Player[]; matches: Match[] },
  graphs: MatchGraphPayload[],
): { players: Player[]; matches: Match[] } {
  const remoteMatches = graphs.map((g) => g.match);
  const profileMap = new Map<string, PublicProfileRow>();
  for (const g of graphs) {
    for (const p of g.profiles) profileMap.set(p.id, p);
  }
  const profiles = [...profileMap.values()];
  const localOnly = state.matches.filter((m) => !isRemoteMatchId(m.id));
  const mergedMatches = [...remoteMatches, ...localOnly].sort(
    (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
  );
  const players = upsertProfilesIntoPlayers(state.players, profiles);
  return {
    matches: mergedMatches,
    players: withSyncedStats(players, mergedMatches),
  };
}
