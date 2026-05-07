import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { buildSeedState, createJoinCode, CURRENT_USER_ID, STORE_VERSION } from '../data/seed';
import type {
  Attendee,
  Group,
  GroupMembership,
  Match,
  MatchStatus,
  Player,
  RSVPStatus,
  ScoreResult,
  SelfReportRequest,
  SelfReportType,
} from '../types/domain';
import { createGroupRemote, fetchMyGroups, joinGroupRemote, leaveGroupRemote } from '../services/supabase/groups';
import { isAppError, shouldRetry, toUserMessage } from '../services/supabase/errors';
import { fetchMatchGraph, fetchMyMatchesGraph, scoreResultToRpcPayload } from '../services/supabase/matchGraph';
import type { MatchGraphPayload } from '../services/supabase/matchGraph';
import {
  insertMatchWithOrganizerAttendee,
  joinMatchByJoinCode as joinMatchByJoinCodeRpc,
  submitMatchResultRpc,
} from '../services/supabase/matches';
import type { ProfileRow, PublicProfileRow } from '../services/supabase/types';
import {
  insertSelfReportRemote,
  replaceMatchTeamPlayersRemote,
  updateMatchAttendeeRemote,
  updateMatchOrganizerFieldsRemote,
  updateSelfReportStatusRemote,
} from '../services/supabase/matchMutations';
import { createId } from '../utils/id';
import { isRemoteMatchId } from '../utils/matchId';
import { recomputePlayerStatsFromMatches } from '../utils/stats';

type CreateMatchInput = {
  venue: string;
  startsAt: string;
  maxPlayers: number;
  groupId?: string;
  pricePerPerson?: number;
  iban?: string;
};

function withSyncedStats(players: Player[], matches: Match[]): Player[] {
  return recomputePlayerStatsFromMatches(players, matches);
}

function upsertAttendee(attendees: Attendee[], playerId: string, patch: Partial<Attendee>): Attendee[] {
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

function emptyPlayerStats(): Player['stats'] {
  return {
    matchesPlayed: 0,
    goals: 0,
    assists: 0,
    wins: 0,
    losses: 0,
    draws: 0,
  };
}

function rethrowStoreActionError(action: string, error: unknown, fallbackMessage: string): never {
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

function upsertProfilesIntoPlayers(players: Player[], profiles: PublicProfileRow[] | ProfileRow[]): Player[] {
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

function mergeRemoteGraph(
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

function mergeHydratedRemoteMatches(
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

export type RemoteProfileRow = {
  id: string;
  display_name: string;
  photo_uri: string | null;
  position: Player['position'];
  preferred_foot: Player['preferredFoot'];
  iban: string | null;
};

export interface AppState {
  players: Player[];
  matches: Match[];
  groups: Group[];
  groupMemberships: GroupMembership[];

  remoteUserId: string | null;
  setRemoteUserId: (id: string | null) => void;
  syncPlayerFromRemoteProfile: (row: RemoteProfileRow) => void;

  getCurrentUserId: () => string;
  getPlayer: (id: string) => Player | undefined;
  getMatch: (id: string) => Match | undefined;

  resetToSeed: () => void;

  updatePlayerProfile: (
    playerId: string,
    patch: Partial<Pick<Player, 'name' | 'photoUri' | 'position' | 'preferredFoot' | 'iban'>>,
  ) => void;

  /** Oturum + Supabase maçları yeniden yükler. */
  hydrateRemoteMatches: () => Promise<void>;
  hydrateRemoteGroups: () => Promise<void>;
  refreshRemoteMatch: (matchId: string) => Promise<void>;

  createMatch: (input: CreateMatchInput) => Promise<Match>;
  joinMatchByJoinCode: (code: string) => Promise<Match | null>;
  createGroup: (name: string) => Promise<Group>;
  joinGroup: (joinCode: string) => Promise<Group | null>;
  leaveGroup: (groupId: string) => Promise<void>;

  setRSVP: (matchId: string, playerId: string, status: RSVPStatus) => Promise<void>;
  setPaid: (matchId: string, playerId: string, paid: boolean, actorId: string) => Promise<void>;

  setSelfReportEnabled: (matchId: string, enabled: boolean) => Promise<void>;
  addSelfReport: (matchId: string, playerId: string, type: SelfReportType) => Promise<void>;
  respondSelfReport: (matchId: string, requestId: string, approve: boolean) => Promise<void>;

  setMatchTeams: (matchId: string, teamAIds: string[], teamBIds: string[]) => Promise<void>;
  lockLineup: (matchId: string) => Promise<void>;

  submitScore: (matchId: string, result: ScoreResult) => Promise<void>;
  setMatchStatus: (matchId: string, status: MatchStatus) => Promise<void>;
}

const seed = buildSeedState();

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      players: seed.players,
      matches: seed.matches,
      groups: [],
      groupMemberships: [],
      remoteUserId: null,

      setRemoteUserId: (id) => set({ remoteUserId: id }),

      syncPlayerFromRemoteProfile: (row) =>
        set((state) => {
          const players = [...state.players];
          const idx = players.findIndex((p) => p.id === row.id);
          const merged: Player = {
            id: row.id,
            name: row.display_name.trim() || 'Oyuncu',
            photoUri: row.photo_uri ?? undefined,
            position: row.position,
            preferredFoot: row.preferred_foot,
            iban: row.iban ?? undefined,
            stats: idx >= 0 ? players[idx].stats : emptyPlayerStats(),
          };
          if (idx >= 0) players[idx] = { ...players[idx], ...merged };
          else players.unshift(merged);
          return { players: withSyncedStats(players, state.matches) };
        }),

      getCurrentUserId: () => get().remoteUserId ?? CURRENT_USER_ID,
      getPlayer: (id) => get().players.find((p) => p.id === id),
      getMatch: (id) => get().matches.find((m) => m.id === id),

      resetToSeed: () => {
        const s = buildSeedState();
        set({
          players: s.players,
          matches: s.matches,
          groups: [],
          groupMemberships: [],
          remoteUserId: null,
        });
      },

      updatePlayerProfile: (playerId, patch) =>
        set((state) => ({
          players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)),
        })),

      hydrateRemoteMatches: async () => {
        const uid = get().remoteUserId;
        if (!uid) return;
        try {
          const graphs = await fetchMyMatchesGraph();
          set((state) => mergeHydratedRemoteMatches(state, graphs));
        } catch (error) {
          rethrowStoreActionError(
            'hydrateRemoteMatches',
            error,
            'Maçlar yenilenemedi. Lütfen tekrar deneyin.',
          );
        }
      },

      hydrateRemoteGroups: async () => {
        if (!get().remoteUserId) return;
        const payload = await fetchMyGroups();
        set({ groups: payload.groups, groupMemberships: payload.memberships });
      },

      refreshRemoteMatch: async (matchId) => {
        if (!get().remoteUserId || !isRemoteMatchId(matchId)) return;
        try {
          const graph = await fetchMatchGraph(matchId);
          set((state) => mergeRemoteGraph(state, graph));
        } catch (error) {
          rethrowStoreActionError(
            'refreshRemoteMatch',
            error,
            'Maç bilgileri yenilenemedi. Lütfen tekrar deneyin.',
          );
        }
      },

      createMatch: async (input) => {
        const organizerId = get().getCurrentUserId();
        const uid = get().remoteUserId;

        if (uid) {
          try {
            const joinCode = createJoinCode();
            const row = await insertMatchWithOrganizerAttendee({
              startsAt: input.startsAt,
              venue: input.venue,
              maxPlayers: input.maxPlayers || 14,
              joinCode,
              groupId: input.groupId,
              pricePerPerson: input.pricePerPerson ?? null,
              iban: input.iban ?? null,
            });
            const graph = await fetchMatchGraph(row.id);
            set((state) => mergeRemoteGraph(state, graph));
            return graph.match;
          } catch (error) {
            rethrowStoreActionError('createMatch', error, 'Maç oluşturulamadı.');
          }
        }

        const match: Match = {
          id: createId('match'),
          groupId: input.groupId,
          startsAt: input.startsAt,
          venue: input.venue,
          organizerId,
          maxPlayers: input.maxPlayers || 14,
          pricePerPerson: input.pricePerPerson,
          iban: input.iban,
          joinCode: createJoinCode(),
          attendees: [{ playerId: organizerId, status: 'going', paid: false }],
          teamAIds: [],
          teamBIds: [],
          lineupLocked: false,
          selfReportEnabled: false,
          status: 'upcoming',
          selfReports: [],
        };
        set((state) => ({
          matches: [match, ...state.matches],
        }));
        return match;
      },

      joinMatchByJoinCode: async (code) => {
        const compact = (s: string) => s.replace(/[\s-]/g, '').toUpperCase();
        const needle = compact(code);
        if (!needle) return null;

        const uid = get().remoteUserId;
        if (uid) {
          try {
            const mid = await joinMatchByJoinCodeRpc(code);
            if (!mid) return null;
            const graph = await fetchMatchGraph(mid);
            set((state) => mergeRemoteGraph(state, graph));
            return graph.match;
          } catch (error) {
            rethrowStoreActionError('joinMatchByJoinCode', error, 'Katılım işlemi başarısız oldu.');
          }
        }

        const state = get();
        const found = state.matches.find((m) => {
          if (m.status !== 'upcoming') return false;
          return compact(m.joinCode) === needle;
        });
        if (!found) return null;
        const userId = state.getCurrentUserId();
        set((s) => {
          const matches = s.matches.map((mm) => {
            if (mm.id !== found.id) return mm;
            const attendees = upsertAttendee(mm.attendees, userId, { status: 'going' });
            return { ...mm, attendees };
          });
          return { matches, players: withSyncedStats(s.players, matches) };
        });
        return get().getMatch(found.id) ?? null;
      },

      createGroup: async (name) => {
        const uid = get().remoteUserId;
        if (uid) {
          const group = await createGroupRemote(name);
          await get().hydrateRemoteGroups();
          return group;
        }
        const localGroup: Group = {
          id: createId('group'),
          name,
          ownerId: get().getCurrentUserId(),
          joinCode: createJoinCode(),
          createdAt: new Date().toISOString(),
        };
        const membership: GroupMembership = {
          groupId: localGroup.id,
          playerId: localGroup.ownerId,
          role: 'owner',
          createdAt: localGroup.createdAt,
        };
        set((state) => ({
          groups: [localGroup, ...state.groups],
          groupMemberships: [membership, ...state.groupMemberships],
        }));
        return localGroup;
      },

      joinGroup: async (joinCode) => {
        const uid = get().remoteUserId;
        if (uid) {
          const joined = await joinGroupRemote(joinCode);
          await get().hydrateRemoteGroups();
          return joined;
        }
        const compact = joinCode.replace(/[\s-]/g, '').toUpperCase();
        const state = get();
        const found = state.groups.find(
          (group) => group.joinCode.replace(/[\s-]/g, '').toUpperCase() === compact,
        );
        if (!found) return null;
        const currentUserId = state.getCurrentUserId();
        if (
          !state.groupMemberships.some(
            (membership) => membership.groupId === found.id && membership.playerId === currentUserId,
          )
        ) {
          set((prev) => ({
            groupMemberships: [
              ...prev.groupMemberships,
              {
                groupId: found.id,
                playerId: currentUserId,
                role: 'member',
                createdAt: new Date().toISOString(),
              },
            ],
          }));
        }
        return found;
      },

      leaveGroup: async (groupId) => {
        const uid = get().remoteUserId;
        if (uid) {
          await leaveGroupRemote(groupId);
          await get().hydrateRemoteGroups();
          return;
        }
        const currentUserId = get().getCurrentUserId();
        set((state) => ({
          groupMemberships: state.groupMemberships.filter(
            (membership) => !(membership.groupId === groupId && membership.playerId === currentUserId),
          ),
        }));
      },

      setRSVP: async (matchId, playerId, status) => {
        if (get().remoteUserId && isRemoteMatchId(matchId)) {
          await updateMatchAttendeeRemote(matchId, playerId, { status });
          const graph = await fetchMatchGraph(matchId);
          set((state) => mergeRemoteGraph(state, graph));
          return;
        }
        set((state) => {
          const matches = state.matches.map((m) => {
            if (m.id !== matchId) return m;
            const attendees = upsertAttendee(m.attendees, playerId, { status });
            return { ...m, attendees };
          });
          return { matches, players: withSyncedStats(state.players, matches) };
        });
      },

      setPaid: async (matchId, playerId, paid, actorId) => {
        const stateSnap = get();
        const m = stateSnap.matches.find((x) => x.id === matchId);
        if (!m) return;
        const isOrganizer = m.organizerId === actorId;
        if (!isOrganizer && playerId !== actorId) return;

        if (stateSnap.remoteUserId && isRemoteMatchId(matchId)) {
          await updateMatchAttendeeRemote(matchId, playerId, { paid });
          const graph = await fetchMatchGraph(matchId);
          set((state) => mergeRemoteGraph(state, graph));
          return;
        }

        set((state) => {
          const matches = state.matches.map((mm) => {
            if (mm.id !== matchId) return mm;
            const attendees = upsertAttendee(mm.attendees, playerId, { paid });
            return { ...mm, attendees };
          });
          return { matches, players: withSyncedStats(state.players, matches) };
        });
      },

      setSelfReportEnabled: async (matchId, enabled) => {
        if (get().remoteUserId && isRemoteMatchId(matchId)) {
          await updateMatchOrganizerFieldsRemote(matchId, { self_report_enabled: enabled });
          const graph = await fetchMatchGraph(matchId);
          set((state) => mergeRemoteGraph(state, graph));
          return;
        }
        set((state) => ({
          matches: state.matches.map((m) =>
            m.id === matchId ? { ...m, selfReportEnabled: enabled } : m,
          ),
        }));
      },

      addSelfReport: async (matchId, playerId, type) => {
        if (get().remoteUserId && isRemoteMatchId(matchId)) {
          await insertSelfReportRemote(matchId, playerId, type);
          const graph = await fetchMatchGraph(matchId);
          set((state) => mergeRemoteGraph(state, graph));
          return;
        }
        set((state) => {
          const matches = state.matches.map((m) => {
            if (m.id !== matchId) return m;
            const req: SelfReportRequest = {
              id: createId('sr'),
              matchId,
              playerId,
              type,
              status: 'pending',
            };
            return { ...m, selfReports: [...m.selfReports, req] };
          });
          return { matches };
        });
      },

      respondSelfReport: async (matchId, requestId, approve) => {
        if (get().remoteUserId && isRemoteMatchId(matchId)) {
          await updateSelfReportStatusRemote(requestId, approve ? 'approved' : 'rejected');
          const graph = await fetchMatchGraph(matchId);
          set((state) => mergeRemoteGraph(state, graph));
          return;
        }
        set((state) => ({
          matches: state.matches.map((m) => {
            if (m.id !== matchId) return m;
            return {
              ...m,
              selfReports: m.selfReports.map((r) =>
                r.id === requestId
                  ? { ...r, status: approve ? ('approved' as const) : ('rejected' as const) }
                  : r,
              ),
            };
          }),
        }));
      },

      setMatchTeams: async (matchId, teamAIds, teamBIds) => {
        if (get().remoteUserId && isRemoteMatchId(matchId)) {
          await replaceMatchTeamPlayersRemote(matchId, teamAIds, teamBIds);
          const graph = await fetchMatchGraph(matchId);
          set((state) => mergeRemoteGraph(state, graph));
          return;
        }
        set((state) => ({
          matches: state.matches.map((m) =>
            m.id === matchId ? { ...m, teamAIds, teamBIds } : m,
          ),
        }));
      },

      lockLineup: async (matchId) => {
        if (get().remoteUserId && isRemoteMatchId(matchId)) {
          await updateMatchOrganizerFieldsRemote(matchId, { lineup_locked: true });
          const graph = await fetchMatchGraph(matchId);
          set((state) => mergeRemoteGraph(state, graph));
          return;
        }
        set((state) => ({
          matches: state.matches.map((m) =>
            m.id === matchId ? { ...m, lineupLocked: true } : m,
          ),
        }));
      },

      setMatchStatus: async (matchId, status) => {
        if (get().remoteUserId && isRemoteMatchId(matchId)) {
          await updateMatchOrganizerFieldsRemote(matchId, { status });
          const graph = await fetchMatchGraph(matchId);
          set((state) => mergeRemoteGraph(state, graph));
          return;
        }
        set((state) => ({
          matches: state.matches.map((m) => (m.id === matchId ? { ...m, status } : m)),
        }));
      },

      submitScore: async (matchId, result) => {
        if (get().remoteUserId && isRemoteMatchId(matchId)) {
          const payload = scoreResultToRpcPayload(result);
          await submitMatchResultRpc({
            matchId,
            scoreA: result.scoreA,
            scoreB: result.scoreB,
            scorers: payload.scorers,
            assists: payload.assists,
          });
          const graph = await fetchMatchGraph(matchId);
          set((state) => mergeRemoteGraph(state, graph));
          return;
        }

        set((state) => {
          const matches = state.matches.map((m) => {
            if (m.id !== matchId) return m;
            let merged: ScoreResult = { ...result };
            const approved = m.selfReports.filter((r) => r.status === 'approved');
            for (const r of approved) {
              if (r.type === 'goal')
                merged = {
                  ...merged,
                  scorers: mergeStatLines(merged.scorers, r.playerId, 1),
                };
              else
                merged = {
                  ...merged,
                  assists: mergeStatLines(merged.assists, r.playerId, 1),
                };
            }
            return {
              ...m,
              status: 'finished' as const,
              result: merged,
            };
          });
          return { matches, players: withSyncedStats(state.players, matches) };
        });
      },
    }),
    {
      name: 'halisaha-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: STORE_VERSION,
      partialize: (s) => ({
        players: s.players,
        matches: s.matches,
        groups: s.groups,
        groupMemberships: s.groupMemberships,
      }),
      migrate: (persisted: unknown, version: number) => {
        if (version !== STORE_VERSION) {
          const fresh = buildSeedState();
          return { players: fresh.players, matches: fresh.matches, groups: [], groupMemberships: [] };
        }
        return persisted as {
          players: Player[];
          matches: Match[];
          groups: Group[];
          groupMemberships: GroupMembership[];
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) console.warn('persist error', error);
      },
    },
  ),
);
