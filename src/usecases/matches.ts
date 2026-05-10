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
  submitMatchRatingsBundleRemote,
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
import { canRespondToSelfReportRequest } from '../utils/selfReportPeerReview';
import type { CreateMatchInput } from '../store/types';
import { AppError, createAuthRequiredError, createNotFoundError } from '../services/supabase/errors';
import { rethrowUseCaseError } from './errors';

type MatchesDeps = {
  getRemoteUserId: () => string | null;
  getLocalMatch: (matchId: string) => Match | undefined;
  mergeHydratedRemoteMatches: (graphs: MatchGraphPayload[]) => void;
  mergeRemoteGraph: (graph: MatchGraphPayload) => void;
  createLocalMatch: (input: CreateMatchInput) => Match;
  joinLocalMatchByJoinCode: (code: string) => Match | null;
  setLocalRsvp: (matchId: string, playerId: string, status: RSVPStatus) => void;
  setLocalPaid: (matchId: string, playerId: string, paid: boolean, actorId: string) => void;
  setLocalSelfReportEnabled: (matchId: string, enabled: boolean) => void;
  addLocalSelfReport: (matchId: string, playerId: string, type: SelfReportType) => void;
  respondLocalSelfReport: (matchId: string, requestId: string, approve: boolean) => void;
  setLocalMatchTeams: (
    matchId: string,
    teamAIds: string[],
    teamBIds: string[],
    lineupFormationId?: string | null,
  ) => void;
  lockLocalLineup: (matchId: string) => void;
  unlockLocalLineup: (matchId: string) => void;
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
  const startsMs = new Date(input.startsAt).getTime();
  if (!Number.isFinite(startsMs) || startsMs < Date.now()) {
    throw new AppError({
      code: 'VALIDATION',
      operation: 'createMatch',
      translationKey: 'errors.rpc.matchStartsAtPast',
      retryable: false,
    });
  }

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
        ibanAccountName: input.ibanAccountName ?? null,
        paymentNote: input.paymentNote ?? null,
        paymentMethod: input.paymentMethod,
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
  const match = deps.getLocalMatch(matchId);
  const req = match?.selfReports.find((r) => r.id === requestId);
  if (!match || !req) {
    throw createNotFoundError('respondSelfReport', 'Bildirim bulunamadı.');
  }

  const viewerId = deps.getRemoteUserId();
  if (!viewerId) {
    throw createAuthRequiredError('respondSelfReport');
  }

  if (!canRespondToSelfReportRequest(match, req.playerId, viewerId)) {
    throw new AppError({
      code: 'FORBIDDEN',
      operation: 'respondSelfReport',
      message: 'Bu bildirimi onaylayamazsınız.',
      retryable: false,
    });
  }

  if (isRemoteMatchId(matchId)) {
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
  lineupFormationId?: string | null,
): Promise<void> {
  if (deps.getRemoteUserId() && isRemoteMatchId(matchId)) {
    await replaceMatchTeamPlayersRemote(matchId, teamAIds, teamBIds);
    const graph = await fetchMatchGraph(matchId);
    deps.mergeRemoteGraph(graph);
    if (lineupFormationId !== undefined) {
      deps.setLocalMatchTeams(matchId, teamAIds, teamBIds, lineupFormationId);
    }
    return;
  }
  deps.setLocalMatchTeams(matchId, teamAIds, teamBIds, lineupFormationId);
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

export async function unlockLineupUseCase(deps: MatchesDeps, matchId: string): Promise<void> {
  if (deps.getRemoteUserId() && isRemoteMatchId(matchId)) {
    await updateMatchOrganizerFieldsRemote(matchId, { lineup_locked: false });
    const graph = await fetchMatchGraph(matchId);
    deps.mergeRemoteGraph(graph);
    return;
  }
  deps.unlockLocalLineup(matchId);
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

export async function cancelMatchUseCase(deps: MatchesDeps, matchId: string): Promise<void> {
  const local = deps.getLocalMatch(matchId);
  if (local && (local.status === 'finished' || local.status === 'cancelled')) {
    throw new AppError({
      code: 'VALIDATION',
      operation: 'cancelMatch',
      message:
        local.status === 'cancelled'
          ? 'Bu maç zaten iptal edilmiş.'
          : 'Bitmiş bir maç iptal edilemez.',
      retryable: false,
    });
  }
  await setMatchStatusUseCase(deps, matchId, 'cancelled');
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
      ownGoals: payload.own_goals,
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
    await submitMatchRatingsBundleRemote(matchId, args.scores, args.motmPickId);
  } catch (error) {
    rethrowUseCaseError(
      'submitMatchRatings',
      error,
      'Derecelendirme kaydedilemedi. Kontrol edip tekrar deneyin.',
    );
  }
}
