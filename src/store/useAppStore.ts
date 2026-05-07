import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { buildSeedState, createJoinCode, CURRENT_USER_ID, STORE_VERSION } from '../data/seed';
import type {
  Attendee,
  Match,
  MatchStatus,
  Player,
  RSVPStatus,
  ScoreResult,
  SelfReportRequest,
  SelfReportType,
} from '../types/domain';
import { createId } from '../utils/id';
import { recomputePlayerStatsFromMatches } from '../utils/stats';

type CreateMatchInput = {
  venue: string;
  startsAt: string;
  maxPlayers: number;
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

export interface AppState {
  players: Player[];
  matches: Match[];

  getCurrentUserId: () => string;
  getPlayer: (id: string) => Player | undefined;
  getMatch: (id: string) => Match | undefined;

  resetToSeed: () => void;

  updatePlayerProfile: (
    playerId: string,
    patch: Partial<Pick<Player, 'name' | 'photoUri' | 'position' | 'preferredFoot' | 'iban'>>,
  ) => void;

  createMatch: (input: CreateMatchInput) => Match;
  /** Katılım kodu ile mevcut kullanıcıyı maça "going" olarak ekler / günceller */
  joinMatchByJoinCode: (code: string) => Match | null;

  setRSVP: (matchId: string, playerId: string, status: RSVPStatus) => void;
  setPaid: (matchId: string, playerId: string, paid: boolean, actorId: string) => void;

  setSelfReportEnabled: (matchId: string, enabled: boolean) => void;
  addSelfReport: (matchId: string, playerId: string, type: SelfReportType) => void;
  respondSelfReport: (matchId: string, requestId: string, approve: boolean) => void;

  setMatchTeams: (matchId: string, teamAIds: string[], teamBIds: string[]) => void;
  lockLineup: (matchId: string) => void;

  submitScore: (matchId: string, result: ScoreResult) => void;
  setMatchStatus: (matchId: string, status: MatchStatus) => void;
}

const seed = buildSeedState();

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      players: seed.players,
      matches: seed.matches,
      getCurrentUserId: () => CURRENT_USER_ID,
      getPlayer: (id) => get().players.find((p) => p.id === id),
      getMatch: (id) => get().matches.find((m) => m.id === id),

      resetToSeed: () => {
        const s = buildSeedState();
        set({ players: s.players, matches: s.matches });
      },

      updatePlayerProfile: (playerId, patch) =>
        set((state) => ({
          players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)),
        })),

      createMatch: (input) => {
        const organizerId = CURRENT_USER_ID;
        const match: Match = {
          id: createId('match'),
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

      joinMatchByJoinCode: (code) => {
        const compact = (s: string) => s.replace(/[\s-]/g, '').toUpperCase();
        const needle = compact(code);
        if (!needle) return null;
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

      setRSVP: (matchId, playerId, status) =>
        set((state) => {
          const matches = state.matches.map((m) => {
            if (m.id !== matchId) return m;
            const attendees = upsertAttendee(m.attendees, playerId, { status });
            return { ...m, attendees };
          });
          return { matches, players: withSyncedStats(state.players, matches) };
        }),

      setPaid: (matchId, playerId, paid, actorId) =>
        set((state) => {
          const m = state.matches.find((x) => x.id === matchId);
          if (!m) return state;
          const isOrganizer = m.organizerId === actorId;
          if (!isOrganizer && playerId !== actorId) return state;
          const matches = state.matches.map((mm) => {
            if (mm.id !== matchId) return mm;
            const attendees = upsertAttendee(mm.attendees, playerId, { paid });
            return { ...mm, attendees };
          });
          return { matches, players: withSyncedStats(state.players, matches) };
        }),

      setSelfReportEnabled: (matchId, enabled) =>
        set((state) => ({
          matches: state.matches.map((m) =>
            m.id === matchId ? { ...m, selfReportEnabled: enabled } : m,
          ),
        })),

      addSelfReport: (matchId, playerId, type) =>
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
        }),

      respondSelfReport: (matchId, requestId, approve) =>
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
        })),

      setMatchTeams: (matchId, teamAIds, teamBIds) =>
        set((state) => ({
          matches: state.matches.map((m) =>
            m.id === matchId ? { ...m, teamAIds, teamBIds } : m,
          ),
        })),

      lockLineup: (matchId) =>
        set((state) => ({
          matches: state.matches.map((m) =>
            m.id === matchId ? { ...m, lineupLocked: true } : m,
          ),
        })),

      setMatchStatus: (matchId, status) =>
        set((state) => ({
          matches: state.matches.map((m) => (m.id === matchId ? { ...m, status } : m)),
        })),

      submitScore: (matchId, result) =>
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
        }),
    }),
    {
      name: 'halisaha-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: STORE_VERSION,
      partialize: (s) => ({
        players: s.players,
        matches: s.matches,
      }),
      migrate: (persisted: unknown, version: number) => {
        if (version !== STORE_VERSION) {
          const fresh = buildSeedState();
          return { players: fresh.players, matches: fresh.matches };
        }
        return persisted as { players: Player[]; matches: Match[] };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) console.warn('persist error', error);
      },
    },
  ),
);
