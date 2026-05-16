import type { StateCreator } from 'zustand';
import { createJoinCode } from '../../data/seed';
import type {
  Match,
  MatchStatus,
  Player,
  RSVPStatus,
  ScoreResult,
  SelfReportRequest,
  SelfReportType,
} from '../../types/domain';
import type { MatchGraphPageCursor, MatchGraphPayload } from '../../services/supabase/matchGraph';
import { fetchMyMatchesGraphPage, MATCH_PAGE_SIZE } from '../../services/supabase/matchGraph';
import { createId } from '../../utils/id';
import {
  addSelfReportUseCase,
  cancelMatchUseCase,
  createMatchUseCase,
  hydrateRemoteMatchesUseCase,
  joinMatchByJoinCodeUseCase,
  loadMatchRatingSummaryUseCase,
  lockLineupUseCase,
  unlockLineupUseCase,
  refreshRemoteMatchUseCase,
  respondSelfReportUseCase,
  setMatchStatusUseCase,
  setMatchTeamsUseCase,
  setPaidUseCase,
  setRsvpUseCase,
  setSelfReportEnabledUseCase,
  submitMatchRatingsUseCase,
  submitScoreUseCase,
  updateMatchDetailsUseCase,
} from '../../usecases/matches';
import { isRemoteMatchId } from '../../utils/matchId';
import { patchPlayersStatsForMatchTransition } from '../../utils/stats';
import {
  appendRemoteMatchPage,
  mergeHydratedRemoteMatches,
  mergeRemoteGraph,
  mergeStatLines,
  upsertAttendee,
} from '../helpers';
import { storeSeed } from '../storeSeed';
import type { AppState, CreateMatchInput, MatchesSlice, PeerRatingInput } from '../types';

function applyPlayerRatingAggregatesFromSummary(
  players: AppState['players'],
  summary: NonNullable<AppState['matchRatingSummariesById'][string]>,
) {
  const byId = new Map(summary.players.map((p) => [p.player_id, p]));
  return players.map((player) => {
    const s = byId.get(player.id);
    if (!s) return player;
    return {
      ...player,
      stats: {
        ...player.stats,
        ratingAverage100: s.overall_avg ?? player.stats.ratingAverage100,
        ratingVoteCount: s.overall_votes_count ?? player.stats.ratingVoteCount ?? 0,
        motmCount: s.overall_motm_count ?? player.stats.motmCount ?? 0,
      },
    };
  });
}

function applyHydratedRemoteMatches(set: Parameters<StateCreator<AppState>>[0], graphs: MatchGraphPayload[]) {
  set((state) => mergeHydratedRemoteMatches(state, graphs));
}

function applyRemoteGraph(set: Parameters<StateCreator<AppState>>[0], graph: MatchGraphPayload) {
  set((state) => mergeRemoteGraph(state, graph));
}

function createLocalMatch(
  set: Parameters<StateCreator<AppState>>[0],
  get: Parameters<StateCreator<AppState>>[1],
  input: CreateMatchInput,
): Match {
  const organizerId = get().getCurrentUserId();
  const match: Match = {
    id: createId('match'),
    groupId: input.groupId,
    startsAt: input.startsAt,
    venue: input.venue,
    organizerId,
    maxPlayers: input.maxPlayers || 14,
    pricePerPerson: input.pricePerPerson,
    iban: input.iban,
    ibanAccountName: input.ibanAccountName,
    paymentNote: input.paymentNote,
    paymentMethod: input.paymentMethod,
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
}

function joinLocalMatchByJoinCode(
  set: Parameters<StateCreator<AppState>>[0],
  get: Parameters<StateCreator<AppState>>[1],
  code: string,
): Match | null {
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
    return { matches };
  });
  return get().getMatch(found.id) ?? null;
}

function patchLocalMatch(
  set: Parameters<StateCreator<AppState>>[0],
  matchId: string,
  patch: Partial<Match>,
) {
  set((state) => {
    const matches = state.matches.map((m) => {
      if (m.id !== matchId) return m;
      return { ...m, ...patch };
    });
    return { matches };
  });
}

function setLocalRsvp(
  set: Parameters<StateCreator<AppState>>[0],
  matchId: string,
  playerId: string,
  status: RSVPStatus,
) {
  set((state) => {
    const matches = state.matches.map((m) => {
      if (m.id !== matchId) return m;
      const attendees = upsertAttendee(m.attendees, playerId, { status });
      return { ...m, attendees };
    });
    return { matches };
  });
}

function setLocalPaid(
  set: Parameters<StateCreator<AppState>>[0],
  get: Parameters<StateCreator<AppState>>[1],
  matchId: string,
  playerId: string,
  paid: boolean,
  actorId: string,
) {
  const stateSnap = get();
  const m = stateSnap.matches.find((x) => x.id === matchId);
  if (!m) return;
  const isOrganizer = m.organizerId === actorId;
  if (!isOrganizer && playerId !== actorId) return;

  set((state) => {
    const matches = state.matches.map((mm) => {
      if (mm.id !== matchId) return mm;
      const attendees = upsertAttendee(mm.attendees, playerId, { paid });
      return { ...mm, attendees };
    });
    return { matches };
  });
}

function setLocalSelfReportEnabled(set: Parameters<StateCreator<AppState>>[0], matchId: string, enabled: boolean) {
  set((state) => ({
    matches: state.matches.map((m) => (m.id === matchId ? { ...m, selfReportEnabled: enabled } : m)),
  }));
}

function addLocalSelfReport(
  set: Parameters<StateCreator<AppState>>[0],
  matchId: string,
  playerId: string,
  type: SelfReportType,
) {
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
}

function respondLocalSelfReport(
  set: Parameters<StateCreator<AppState>>[0],
  matchId: string,
  requestId: string,
  approve: boolean,
) {
  set((state) => {
    const prev = state.matches.find((m) => m.id === matchId);
    const matches = state.matches.map((m) => {
      if (m.id !== matchId) return m;
      const selfReports = m.selfReports.map((r) =>
        r.id === requestId ? { ...r, status: approve ? ('approved' as const) : ('rejected' as const) } : r,
      );
      const reqRow = selfReports.find((r) => r.id === requestId);
      let next: Match = { ...m, selfReports };
      if (approve && reqRow?.status === 'approved' && m.status === 'finished' && m.result) {
        if (reqRow.type === 'goal') {
          next = {
            ...next,
            result: {
              ...m.result,
              ownGoals: m.result.ownGoals ?? [],
              scorers: mergeStatLines(m.result.scorers, reqRow.playerId, 1),
            },
          };
        } else {
          next = {
            ...next,
            result: {
              ...m.result,
              ownGoals: m.result.ownGoals ?? [],
              assists: mergeStatLines(m.result.assists, reqRow.playerId, 1),
            },
          };
        }
      }
      return next;
    });
    const nextMatch = matches.find((m) => m.id === matchId);
    const players = patchPlayersStatsForMatchTransition(state.players, prev, nextMatch);
    return { matches, players };
  });
}

function setLocalMatchTeams(
  set: Parameters<StateCreator<AppState>>[0],
  matchId: string,
  teamAIds: string[],
  teamBIds: string[],
  lineupFormationId?: string | null,
  lineupSlotsA?: (string | null)[] | null,
  lineupSlotsB?: (string | null)[] | null,
) {
  set((state) => ({
    matches: state.matches.map((m) => {
      if (m.id !== matchId) return m;
      const patch: Partial<Match> = { teamAIds, teamBIds };
      if (lineupFormationId !== undefined) {
        patch.lineupFormationId = lineupFormationId;
      }
      if (lineupSlotsA !== undefined) {
        patch.lineupSlotsA = lineupSlotsA ?? undefined;
      }
      if (lineupSlotsB !== undefined) {
        patch.lineupSlotsB = lineupSlotsB ?? undefined;
      }
      return { ...m, ...patch };
    }),
  }));
}

function lockLocalLineup(set: Parameters<StateCreator<AppState>>[0], matchId: string) {
  set((state) => ({
    matches: state.matches.map((m) => (m.id === matchId ? { ...m, lineupLocked: true } : m)),
  }));
}

function unlockLocalLineup(set: Parameters<StateCreator<AppState>>[0], matchId: string) {
  set((state) => ({
    matches: state.matches.map((m) => (m.id === matchId ? { ...m, lineupLocked: false } : m)),
  }));
}

function setLocalMatchStatus(set: Parameters<StateCreator<AppState>>[0], matchId: string, status: MatchStatus) {
  set((state) => ({
    matches: state.matches.map((m) => (m.id === matchId ? { ...m, status } : m)),
  }));
}

function submitLocalScore(set: Parameters<StateCreator<AppState>>[0], matchId: string, result: ScoreResult) {
  set((state) => {
    const prev = state.matches.find((m) => m.id === matchId);
    const matches = state.matches.map((m) => {
      if (m.id !== matchId) return m;
      let merged: ScoreResult = { ...result, ownGoals: result.ownGoals ?? [] };
      const approved = m.selfReports.filter((r) => r.status === 'approved');
      for (const r of approved) {
        if (r.type === 'goal') {
          merged = {
            ...merged,
            scorers: mergeStatLines(merged.scorers, r.playerId, 1),
          };
        } else {
          merged = {
            ...merged,
            assists: mergeStatLines(merged.assists, r.playerId, 1),
          };
        }
      }
      return {
        ...m,
        status: 'finished' as const,
        result: merged,
      };
    });
    const nextMatch = matches.find((m) => m.id === matchId);
    const players = patchPlayersStatsForMatchTransition(state.players, prev, nextMatch);
    return { matches, players };
  });
}

function buildMatchesUseCaseDeps(set: Parameters<StateCreator<AppState>>[0], get: Parameters<StateCreator<AppState>>[1]) {
  return {
    getRemoteUserId: () => get().remoteUserId,
    getLocalMatch: (matchId: string) => get().getMatch(matchId),
    mergeHydratedRemoteMatches: (graphs: MatchGraphPayload[]) => applyHydratedRemoteMatches(set, graphs),
    mergeRemoteGraph: (graph: MatchGraphPayload) => applyRemoteGraph(set, graph),
    createLocalMatch: (input: CreateMatchInput) => createLocalMatch(set, get, input),
    patchLocalMatch: (matchId: string, patch: Partial<Match>) => patchLocalMatch(set, matchId, patch),
    joinLocalMatchByJoinCode: (code: string) => joinLocalMatchByJoinCode(set, get, code),
    setLocalRsvp: (matchId: string, playerId: string, status: RSVPStatus) =>
      setLocalRsvp(set, matchId, playerId, status),
    setLocalPaid: (matchId: string, playerId: string, paid: boolean, actorId: string) =>
      setLocalPaid(set, get, matchId, playerId, paid, actorId),
    setLocalSelfReportEnabled: (matchId: string, enabled: boolean) => setLocalSelfReportEnabled(set, matchId, enabled),
    addLocalSelfReport: (matchId: string, playerId: string, type: SelfReportType) =>
      addLocalSelfReport(set, matchId, playerId, type),
    respondLocalSelfReport: (matchId: string, requestId: string, approve: boolean) =>
      respondLocalSelfReport(set, matchId, requestId, approve),
    setLocalMatchTeams: (
      matchId: string,
      teamAIds: string[],
      teamBIds: string[],
      lineupFormationId?: string | null,
      lineupSlotsA?: (string | null)[] | null,
      lineupSlotsB?: (string | null)[] | null,
    ) => setLocalMatchTeams(set, matchId, teamAIds, teamBIds, lineupFormationId, lineupSlotsA, lineupSlotsB),
    lockLocalLineup: (matchId: string) => lockLocalLineup(set, matchId),
    unlockLocalLineup: (matchId: string) => unlockLocalLineup(set, matchId),
    setLocalMatchStatus: (matchId: string, status: MatchStatus) => setLocalMatchStatus(set, matchId, status),
    submitLocalScore: (matchId: string, result: ScoreResult) => submitLocalScore(set, matchId, result),
    getMatchesSnapshot: () => get().matches,
    restoreMatchesSnapshot: (snapshot: Match[]) => set({ matches: snapshot }),
    getPlayersSnapshot: () => get().players,
    restorePlayersSnapshot: (snapshot: Player[]) => set({ players: snapshot }),
    onHydrationPage: (nextCursor: MatchGraphPageCursor | null, hasMore: boolean) =>
      set({ remoteMatchesCursor: nextCursor, hasMoreRemoteMatches: hasMore }),
  };
}

function pushPendingListEntrance(prev: string[], id: string): string[] {
  return prev.includes(id) ? prev : [...prev, id];
}

export const createMatchesSlice: StateCreator<AppState, [], [], MatchesSlice> = (set, get) => ({
  matches: storeSeed.matches,

  matchRatingSummariesById: {},

  matchRatingsSubmissionByMatchId: {},

  matchIdsPendingListEntrance: [],

  hasMoreRemoteMatches: false,

  remoteMatchesCursor: null as MatchGraphPageCursor | null,

  markMatchPendingListEntrance: (id) =>
    set((s) => ({
      matchIdsPendingListEntrance: pushPendingListEntrance(s.matchIdsPendingListEntrance, id),
    })),

  clearMatchPendingListEntrance: (id) =>
    set((s) => ({
      matchIdsPendingListEntrance: s.matchIdsPendingListEntrance.filter((x) => x !== id),
    })),

  getMatch: (id) => get().matches.find((m) => m.id === id),

  loadMatchRatingSummary: async (matchId) => {
    if (!get().remoteUserId || !isRemoteMatchId(matchId)) return;
    try {
      const summary = await loadMatchRatingSummaryUseCase(matchId);
      set((s) => ({
        matchRatingSummariesById: { ...s.matchRatingSummariesById, [matchId]: summary ?? undefined },
        players: summary ? applyPlayerRatingAggregatesFromSummary(s.players, summary) : s.players,
      }));
    } catch {
      set((s) => ({
        matchRatingSummariesById: { ...s.matchRatingSummariesById, [matchId]: undefined },
      }));
    }
  },

  submitMatchRatings: async (matchId: string, scores: PeerRatingInput[], motmPickId: string) => {
    await submitMatchRatingsUseCase(matchId, { scores, motmPickId });
    await get().loadMatchRatingSummary(matchId);
    set((s) => ({
      matchRatingsSubmissionByMatchId: { ...s.matchRatingsSubmissionByMatchId, [matchId]: true },
    }));
  },

  hydrateRemoteMatches: (opts) =>
    hydrateRemoteMatchesUseCase(buildMatchesUseCaseDeps(set, get), opts),

  loadMoreRemoteMatches: async () => {
    const state = get();
    if (!state.remoteUserId || !state.hasMoreRemoteMatches || !state.remoteMatchesCursor) return;
    try {
      const { graphs, nextCursor } = await fetchMyMatchesGraphPage(
        state.remoteMatchesCursor,
        MATCH_PAGE_SIZE,
      );
      set((s) => ({
        ...appendRemoteMatchPage(s, graphs),
        remoteMatchesCursor: nextCursor,
        hasMoreRemoteMatches: nextCursor !== null,
      }));
    } catch (error) {
      console.warn('[loadMoreRemoteMatches] failed', error);
    }
  },

  refreshRemoteMatch: async (matchId) => {
    await refreshRemoteMatchUseCase(buildMatchesUseCaseDeps(set, get), matchId);
    set((s) => {
      const next = { ...s.matchRatingSummariesById };
      delete next[matchId];
      return { matchRatingSummariesById: next };
    });
  },

  createMatch: async (input) => {
    const m = await createMatchUseCase(buildMatchesUseCaseDeps(set, get), input);
    set((s) => ({
      matchIdsPendingListEntrance: pushPendingListEntrance(s.matchIdsPendingListEntrance, m.id),
    }));
    return m;
  },

  updateMatchDetails: async (input) => {
    await updateMatchDetailsUseCase(buildMatchesUseCaseDeps(set, get), input);
  },

  joinMatchByJoinCode: async (code) => {
    const beforeIds = new Set(get().matches.map((x) => x.id));
    const m = await joinMatchByJoinCodeUseCase(buildMatchesUseCaseDeps(set, get), code);
    if (m && !beforeIds.has(m.id)) {
      set((s) => ({
        matchIdsPendingListEntrance: pushPendingListEntrance(s.matchIdsPendingListEntrance, m.id),
      }));
    }
    return m;
  },

  setRSVP: (matchId, playerId, status) =>
    setRsvpUseCase(buildMatchesUseCaseDeps(set, get), matchId, playerId, status),

  setPaid: (matchId, playerId, paid, actorId) =>
    setPaidUseCase(buildMatchesUseCaseDeps(set, get), matchId, playerId, paid, actorId),

  setSelfReportEnabled: (matchId, enabled) =>
    setSelfReportEnabledUseCase(buildMatchesUseCaseDeps(set, get), matchId, enabled),

  addSelfReport: (matchId, playerId, type) =>
    addSelfReportUseCase(buildMatchesUseCaseDeps(set, get), matchId, playerId, type),

  respondSelfReport: (matchId, requestId, approve) =>
    respondSelfReportUseCase(buildMatchesUseCaseDeps(set, get), matchId, requestId, approve),

  setMatchTeams: (matchId, teamAIds, teamBIds, lineupFormationId, lineupSlotsA, lineupSlotsB) =>
    setMatchTeamsUseCase(
      buildMatchesUseCaseDeps(set, get),
      matchId,
      teamAIds,
      teamBIds,
      lineupFormationId,
      lineupSlotsA,
      lineupSlotsB,
    ),

  lockLineup: (matchId) => lockLineupUseCase(buildMatchesUseCaseDeps(set, get), matchId),

  unlockLineup: (matchId) => unlockLineupUseCase(buildMatchesUseCaseDeps(set, get), matchId),

  setMatchStatus: (matchId, status) => setMatchStatusUseCase(buildMatchesUseCaseDeps(set, get), matchId, status),

  cancelMatch: (matchId) => cancelMatchUseCase(buildMatchesUseCaseDeps(set, get), matchId),

  submitScore: (matchId, result) => submitScoreUseCase(buildMatchesUseCaseDeps(set, get), matchId, result),
});
