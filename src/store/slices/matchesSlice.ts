import type { StateCreator } from 'zustand';
import { createJoinCode } from '../../data/seed';
import type {
  Match,
  MatchStatus,
  RSVPStatus,
  ScoreResult,
  SelfReportRequest,
  SelfReportType,
} from '../../types/domain';
import { fetchMatchGraph, fetchMyMatchesGraph } from '../../services/supabase/matchGraph';
import { scoreResultToRpcPayload } from '../../services/supabase/mappers';
import {
  insertMatchWithOrganizerAttendee,
  joinMatchByJoinCode as joinMatchByJoinCodeRpc,
  submitMatchResultRpc,
} from '../../services/supabase/matches';
import {
  insertSelfReportRemote,
  replaceMatchTeamPlayersRemote,
  updateMatchAttendeeRemote,
  updateMatchOrganizerFieldsRemote,
  updateSelfReportStatusRemote,
} from '../../services/supabase/matchMutations';
import { createId } from '../../utils/id';
import { isRemoteMatchId } from '../../utils/matchId';
import {
  mergeHydratedRemoteMatches,
  mergeRemoteGraph,
  mergeStatLines,
  rethrowStoreActionError,
  upsertAttendee,
  withSyncedStats,
} from '../helpers';
import { storeSeed } from '../storeSeed';
import type { AppState, MatchesSlice } from '../types';

export const createMatchesSlice: StateCreator<AppState, [], [], MatchesSlice> = (set, get) => ({
  matches: storeSeed.matches,

  getMatch: (id) => get().matches.find((m) => m.id === id),

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
});
