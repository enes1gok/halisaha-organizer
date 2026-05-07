import { createJoinCode } from '../data/seed';
import {
  insertSelfReportRemote,
  replaceMatchTeamPlayersRemote,
  updateMatchAttendeeRemote,
  updateMatchOrganizerFieldsRemote,
  updateSelfReportStatusRemote,
} from '../services/supabase/matchMutations';
import { fetchMatchGraph, fetchMyMatchesGraph } from '../services/supabase/matchGraph';
import { scoreResultToRpcPayload } from '../services/supabase/mappers';
import {
  fetchMatchRatingPublicSummary,
  upsertMatchMotmVoteRemote,
  upsertMatchPeerRatingsRemote,
  type PeerRatingInput,
} from '../services/supabase/matchRatings';
import {
  insertMatchWithOrganizerAttendee,
  joinMatchByJoinCode as joinMatchByJoinCodeRpc,
  submitMatchResultRpc,
} from '../services/supabase/matches';
import type { MatchGraphPayload } from '../services/supabase/matchGraph';
import type { Match, MatchStatus, RSVPStatus, ScoreResult, SelfReportType } from '../types/domain';
import { isRemoteMatchId } from '../utils/matchId';
import type { CreateMatchInput } from '../store/types';
import { rethrowUseCaseError } from './errors';

type MatchesDeps = {
  getRemoteUserId: () => string | null;
  mergeHydratedRemoteMatches: (graphs: MatchGraphPayload[]) => void;
  mergeRemoteGraph: (graph: MatchGraphPayload) => void;
  createLocalMatch: (input: CreateMatchInput) => Match;
  joinLocalMatchByJoinCode: (code: string) => Match | null;
  setLocalRsvp: (matchId: string, playerId: string, status: RSVPStatus) => void;
  setLocalPaid: (matchId: string, playerId: string, paid: boolean, actorId: string) => void;
  setLocalSelfReportEnabled: (matchId: string, enabled: boolean) => void;
  addLocalSelfReport: (matchId: string, playerId: string, type: SelfReportType) => void;
  respondLocalSelfReport: (matchId: string, requestId: string, approve: boolean) => void;
  setLocalMatchTeams: (matchId: string, teamAIds: string[], teamBIds: string[]) => void;
  lockLocalLineup: (matchId: string) => void;
  setLocalMatchStatus: (matchId: string, status: MatchStatus) => void;
  submitLocalScore: (matchId: string, result: ScoreResult) => void;
};

export async function hydrateRemoteMatchesUseCase(deps: MatchesDeps): Promise<void> {
  const uid = deps.getRemoteUserId();
  if (!uid) return;
  try {
    const graphs = await fetchMyMatchesGraph();
    deps.mergeHydratedRemoteMatches(graphs);
  } catch (error) {
    rethrowUseCaseError('hydrateRemoteMatches', error, 'Maclar yenilenemedi. Lutfen tekrar deneyin.');
  }
}

export async function refreshRemoteMatchUseCase(deps: MatchesDeps, matchId: string): Promise<void> {
  if (!deps.getRemoteUserId() || !isRemoteMatchId(matchId)) return;
  try {
    const graph = await fetchMatchGraph(matchId);
    deps.mergeRemoteGraph(graph);
  } catch (error) {
    rethrowUseCaseError('refreshRemoteMatch', error, 'Mac bilgileri yenilenemedi. Lutfen tekrar deneyin.');
  }
}

export async function createMatchUseCase(deps: MatchesDeps, input: CreateMatchInput): Promise<Match> {
  const uid = deps.getRemoteUserId();
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
      deps.mergeRemoteGraph(graph);
      return graph.match;
    } catch (error) {
      rethrowUseCaseError('createMatch', error, 'Mac olusturulamadi.');
    }
  }

  return deps.createLocalMatch(input);
}

export async function joinMatchByJoinCodeUseCase(deps: MatchesDeps, code: string): Promise<Match | null> {
  const compact = (s: string) => s.replace(/[\s-]/g, '').toUpperCase();
  if (!compact(code)) return null;

  const uid = deps.getRemoteUserId();
  if (uid) {
    try {
      const mid = await joinMatchByJoinCodeRpc(code);
      if (!mid) return null;
      const graph = await fetchMatchGraph(mid);
      deps.mergeRemoteGraph(graph);
      return graph.match;
    } catch (error) {
      rethrowUseCaseError('joinMatchByJoinCode', error, 'Katilim islemi basarisiz oldu.');
    }
  }

  return deps.joinLocalMatchByJoinCode(code);
}

export async function setRsvpUseCase(
  deps: MatchesDeps,
  matchId: string,
  playerId: string,
  status: RSVPStatus,
): Promise<void> {
  if (deps.getRemoteUserId() && isRemoteMatchId(matchId)) {
    await updateMatchAttendeeRemote(matchId, playerId, { status });
    const graph = await fetchMatchGraph(matchId);
    deps.mergeRemoteGraph(graph);
    return;
  }
  deps.setLocalRsvp(matchId, playerId, status);
}

export async function setPaidUseCase(
  deps: MatchesDeps,
  matchId: string,
  playerId: string,
  paid: boolean,
  actorId: string,
): Promise<void> {
  if (deps.getRemoteUserId() && isRemoteMatchId(matchId)) {
    await updateMatchAttendeeRemote(matchId, playerId, { paid });
    const graph = await fetchMatchGraph(matchId);
    deps.mergeRemoteGraph(graph);
    return;
  }
  deps.setLocalPaid(matchId, playerId, paid, actorId);
}

export async function setSelfReportEnabledUseCase(
  deps: MatchesDeps,
  matchId: string,
  enabled: boolean,
): Promise<void> {
  if (deps.getRemoteUserId() && isRemoteMatchId(matchId)) {
    await updateMatchOrganizerFieldsRemote(matchId, { self_report_enabled: enabled });
    const graph = await fetchMatchGraph(matchId);
    deps.mergeRemoteGraph(graph);
    return;
  }
  deps.setLocalSelfReportEnabled(matchId, enabled);
}

export async function addSelfReportUseCase(
  deps: MatchesDeps,
  matchId: string,
  playerId: string,
  type: SelfReportType,
): Promise<void> {
  if (deps.getRemoteUserId() && isRemoteMatchId(matchId)) {
    await insertSelfReportRemote(matchId, playerId, type);
    const graph = await fetchMatchGraph(matchId);
    deps.mergeRemoteGraph(graph);
    return;
  }
  deps.addLocalSelfReport(matchId, playerId, type);
}

export async function respondSelfReportUseCase(
  deps: MatchesDeps,
  matchId: string,
  requestId: string,
  approve: boolean,
): Promise<void> {
  if (deps.getRemoteUserId() && isRemoteMatchId(matchId)) {
    await updateSelfReportStatusRemote(requestId, approve ? 'approved' : 'rejected');
    const graph = await fetchMatchGraph(matchId);
    deps.mergeRemoteGraph(graph);
    return;
  }
  deps.respondLocalSelfReport(matchId, requestId, approve);
}

export async function setMatchTeamsUseCase(
  deps: MatchesDeps,
  matchId: string,
  teamAIds: string[],
  teamBIds: string[],
): Promise<void> {
  if (deps.getRemoteUserId() && isRemoteMatchId(matchId)) {
    await replaceMatchTeamPlayersRemote(matchId, teamAIds, teamBIds);
    const graph = await fetchMatchGraph(matchId);
    deps.mergeRemoteGraph(graph);
    return;
  }
  deps.setLocalMatchTeams(matchId, teamAIds, teamBIds);
}

export async function lockLineupUseCase(deps: MatchesDeps, matchId: string): Promise<void> {
  if (deps.getRemoteUserId() && isRemoteMatchId(matchId)) {
    await updateMatchOrganizerFieldsRemote(matchId, { lineup_locked: true });
    const graph = await fetchMatchGraph(matchId);
    deps.mergeRemoteGraph(graph);
    return;
  }
  deps.lockLocalLineup(matchId);
}

export async function setMatchStatusUseCase(
  deps: MatchesDeps,
  matchId: string,
  status: MatchStatus,
): Promise<void> {
  if (deps.getRemoteUserId() && isRemoteMatchId(matchId)) {
    await updateMatchOrganizerFieldsRemote(matchId, { status });
    const graph = await fetchMatchGraph(matchId);
    deps.mergeRemoteGraph(graph);
    return;
  }
  deps.setLocalMatchStatus(matchId, status);
}

export async function submitScoreUseCase(
  deps: MatchesDeps,
  matchId: string,
  result: ScoreResult,
): Promise<void> {
  if (deps.getRemoteUserId() && isRemoteMatchId(matchId)) {
    const payload = scoreResultToRpcPayload(result);
    await submitMatchResultRpc({
      matchId,
      scoreA: result.scoreA,
      scoreB: result.scoreB,
      scorers: payload.scorers,
      assists: payload.assists,
    });
    const graph = await fetchMatchGraph(matchId);
    deps.mergeRemoteGraph(graph);
    return;
  }
  deps.submitLocalScore(matchId, result);
}

export async function loadMatchRatingSummaryUseCase(matchId: string) {
  if (!isRemoteMatchId(matchId)) return null;
  try {
    return await fetchMatchRatingPublicSummary(matchId);
  } catch (error) {
    rethrowUseCaseError(
      'loadMatchRatingSummary',
      error,
      'Derecelendirme özeti yüklenemedi. Yeniden deneyin.',
    );
  }
}

export async function submitMatchRatingsUseCase(
  matchId: string,
  args: { scores: PeerRatingInput[]; motmPickId: string },
): Promise<void> {
  if (!isRemoteMatchId(matchId)) return;
  try {
    await upsertMatchPeerRatingsRemote(matchId, args.scores);
    await upsertMatchMotmVoteRemote(matchId, args.motmPickId);
  } catch (error) {
    rethrowUseCaseError(
      'submitMatchRatings',
      error,
      'Derecelendirme kaydedilemedi. Kontrol edip tekrar deneyin.',
    );
  }
}
