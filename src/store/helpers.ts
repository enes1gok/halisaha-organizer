import type { Attendee, Match, Player } from '../types/domain';
import type { MatchGraphPayload } from '../services/supabase/matchGraph';
import type { ProfileRow, PublicProfileRow } from '../services/supabase/types';
import { appendPhotoUriCacheBuster } from '../utils/photoUri';
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
    ratingAverage100: undefined,
    ratingVoteCount: 0,
    motmCount: 0,
  };
}

export function upsertProfilesIntoPlayers(players: Player[], profiles: PublicProfileRow[] | ProfileRow[]): Player[] {
  let next = [...players];
  for (const pr of profiles) {
    const idx = next.findIndex((p) => p.id === pr.id);
    const stub: Player = {
      id: pr.id,
      name: pr.display_name.trim() || 'Oyuncu',
      photoUri:
        appendPhotoUriCacheBuster(
          pr.photo_uri,
          'updated_at' in pr && typeof pr.updated_at === 'string' ? pr.updated_at : undefined,
        ) ?? undefined,
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

/** Uzak graftan gelen maça yerel kadro şablonu tercihini taşır (sunucuda alan yok). */
export function preserveLocalLineupMeta(prev: Match | undefined, incoming: Match): Match {
  if (!prev?.lineupFormationId) return incoming;
  return { ...incoming, lineupFormationId: prev.lineupFormationId };
}

export function mergeRemoteGraph(
  state: { players: Player[]; matches: Match[] },
  graph: MatchGraphPayload,
): { players: Player[]; matches: Match[] } {
  const players = upsertProfilesIntoPlayers(state.players, graph.profiles);
  const others = state.matches.filter((m) => m.id !== graph.match.id);
  const prev = state.matches.find((m) => m.id === graph.match.id);
  const mergedMatch = preserveLocalLineupMeta(prev, graph.match);
  const mergedMatches = [mergedMatch, ...others];
  return {
    matches: mergedMatches,
    players: withSyncedStats(players, mergedMatches),
  };
}

/**
 * Çoklu uzak maç grafiğini birleştirir ve oyuncu maç istatistiklerini tam yeniden hesaplar.
 *
 * Çok büyük senkronlarda JS iş parçacığını kilitleme ölçülürse, burada `InteractionManager.runAfterInteractions`
 * ile istatistik yeniden hesaplamayı ertelemek düşünülebilir; Zustand `persist` ile birlikte ara durumun diske
 * yazılmasını önlemek için tasarım gerekir (ör. önce `matches` yazıp istatistikleri sonraki tick’te güncellemek
 * veya UI’da “güncelleniyor” durumu).
 */
export function mergeHydratedRemoteMatches(
  state: { players: Player[]; matches: Match[] },
  graphs: MatchGraphPayload[],
): { players: Player[]; matches: Match[] } {
  const prevById = new Map(state.matches.map((m) => [m.id, m]));
  const remoteMatches = graphs.map((g) => {
    const prev = prevById.get(g.match.id);
    return preserveLocalLineupMeta(prev, g.match);
  });
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

/** Oyuncu store'da yokken maç detayında satır kaybetmemek için minimal Player. */
export function stubPlayerForUnknownAttendee(playerId: string): Player {
  return {
    id: playerId,
    name: 'Oyuncu',
    position: 'MID',
    preferredFoot: 'right',
    stats: emptyPlayerStats(),
  };
}

/** Katılımcı satırları için oyuncu kaydı yoksa stub kullanır; isimlere göre TR sıralar. */
export function sortAttendeesWithPlayers(
  attendees: Attendee[],
  getPlayer: (id: string) => Player | undefined,
): { a: Attendee; p: Player }[] {
  return [...attendees]
    .map((a) => ({
      a,
      p: getPlayer(a.playerId) ?? stubPlayerForUnknownAttendee(a.playerId),
    }))
    .sort((x, y) => x.p.name.localeCompare(y.p.name, 'tr'));
}
