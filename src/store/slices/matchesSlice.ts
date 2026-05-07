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
import type { MatchGraphPayload } from '../../services/supabase/matchGraph';
import { createId } from '../../utils/id';
import {
  addSelfReportUseCase,
  createMatchUseCase,
  hydrateRemoteMatchesUseCase,
  joinMatchByJoinCodeUseCase,
  loadMatchRatingSummaryUseCase,
  lockLineupUseCase,
  refreshRemoteMatchUseCase,
  respondSelfReportUseCase,
  setMatchStatusUseCase,
  setMatchTeamsUseCase,
  setPaidUseCase,
  setRsvpUseCase,
  setSelfReportEnabledUseCase,
  submitMatchRatingsUseCase,
  submitScoreUseCase,
} from '../../usecases/matches';
import { isRemoteMatchId } from '../../utils/matchId';
import {
  mergeHydratedRemoteMatches,
  mergeRemoteGraph,
  mergeStatLines,
  upsertAttendee,
  withSyncedStats,
} from '../helpers';
import { storeSeed } from '../storeSeed';
import type { AppState, CreateMatchInput, MatchesSlice, PeerRatingInput } from '../types';

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
    return { matches, players: withSyncedStats(s.players, matches) };
  });
  return get().getMatch(found.id) ?? null;
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
    return { matches, players: withSyncedStats(state.players, matches) };
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
    return { matches, players: withSyncedStats(state.players, matches) };
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
  set((state) => ({
    matches: state.matches.map((m) => {
      if (m.id !== matchId) return m;
      return {
        ...m,
        selfReports: m.selfReports.map((r) =>
          r.id === requestId ? { ...r, status: approve ? ('approved' as const) : ('rejected' as const) } : r,
        ),
      };
    }),
  }));
}

function setLocalMatchTeams(
  set: Parameters<StateCreator<AppState>>[0],
  matchId: string,
  teamAIds: string[],
  teamBIds: string[],
) {
  set((state) => ({
    matches: state.matches.map((m) => (m.id === matchId ? { ...m, teamAIds, teamBIds } : m)),
  }));
}

function lockLocalLineup(set: Parameters<StateCreator<AppState>>[0], matchId: string) {
  set((state) => ({
    matches: state.matches.map((m) => (m.id === matchId ? { ...m, lineupLocked: true } : m)),
  }));
}

function setLocalMatchStatus(set: Parameters<StateCreator<AppState>>[0], matchId: string, status: MatchStatus) {
  set((state) => ({
    matches: state.matches.map((m) => (m.id === matchId ? { ...m, status } : m)),
  }));
}

function submitLocalScore(set: Parameters<StateCreator<AppState>>[0], matchId: string, result: ScoreResult) {
  set((state) => {
    const matches = state.matches.map((m) => {
      if (m.id !== matchId) return m;
      let merged: ScoreResult = { ...result };
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
    return { matches, players: withSyncedStats(state.players, matches) };
  });
}

function buildMatchesUseCaseDeps(set: Parameters<StateCreator<AppState>>[0], get: Parameters<StateCreator<AppState>>[1]) {
  return {
    getRemoteUserId: () => get().remoteUserId,
    mergeHydratedRemoteMatches: (graphs: MatchGraphPayload[]) => applyHydratedRemoteMatches(set, graphs),
    mergeRemoteGraph: (graph: MatchGraphPayload) => applyRemoteGraph(set, graph),
    createLocalMatch: (input: CreateMatchInput) => createLocalMatch(set, get, input),
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
    setLocalMatchTeams: (matchId: string, teamAIds: string[], teamBIds: string[]) =>
      setLocalMatchTeams(set, matchId, teamAIds, teamBIds),
    lockLocalLineup: (matchId: string) => lockLocalLineup(set, matchId),
    setLocalMatchStatus: (matchId: string, status: MatchStatus) => setLocalMatchStatus(set, matchId, status),
    submitLocalScore: (matchId: string, result: ScoreResult) => submitLocalScore(set, matchId, result),
  };
}

export const createMatchesSlice: StateCreator<AppState, [], [], MatchesSlice> = (set, get) => ({
  matches: storeSeed.matches,

  matchRatingSummariesById: {},

  matchRatingsSubmissionByMatchId: {},

  getMatch: (id) => get().matches.find((m) => m.id === id),

  loadMatchRatingSummary: async (matchId) => {
    if (!get().remoteUserId || !isRemoteMatchId(matchId)) return;
    try {
      const summary = await loadMatchRatingSummaryUseCase(matchId);
      set((s) => ({
        matchRatingSummariesById: { ...s.matchRatingSummariesById, [matchId]: summary ?? undefined },
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

  hydrateRemoteMatches: () => hydrateRemoteMatchesUseCase(buildMatchesUseCaseDeps(set, get)),

  refreshRemoteMatch: async (matchId) => {
    await refreshRemoteMatchUseCase(buildMatchesUseCaseDeps(set, get), matchId);
    set((s) => {
      const next = { ...s.matchRatingSummariesById };
      delete next[matchId];
      return { matchRatingSummariesById: next };
    });
  },

  createMatch: (input) => createMatchUseCase(buildMatchesUseCaseDeps(set, get), input),

  joinMatchByJoinCode: (code) => joinMatchByJoinCodeUseCase(buildMatchesUseCaseDeps(set, get), code),

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

  setMatchTeams: (matchId, teamAIds, teamBIds) =>
    setMatchTeamsUseCase(buildMatchesUseCaseDeps(set, get), matchId, teamAIds, teamBIds),

  lockLineup: (matchId) => lockLineupUseCase(buildMatchesUseCaseDeps(set, get), matchId),

  setMatchStatus: (matchId, status) => setMatchStatusUseCase(buildMatchesUseCaseDeps(set, get), matchId, status),

  submitScore: (matchId, result) => submitScoreUseCase(buildMatchesUseCaseDeps(set, get), matchId, result),
});
