import { createJoinCode } from '../data/seed';
import {
  insertSelfReportRemote,
  replaceMatchTeamPlayersRemote,
  updateMatchAttendeeRemote,
  updateMatchDetailsRemote,
  updateMatchOrganizerFieldsRemote,
  updateSelfReportStatusRemote,
} from '../services/supabase/matchMutations';
import { fetchMatchGraph, fetchMyMatchesGraphPage, MATCH_PAGE_SIZE } from '../services/supabase/matchGraph';
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
import type { Match, MatchStatus, Player, RSVPStatus, ScoreResult, SelfReportType } from '../types/domain';
import { isRemoteMatchId } from '../utils/matchId';
import { canRespondToSelfReportRequest } from '../utils/selfReportPeerReview';
import type { CreateMatchInput, EditMatchInput } from '../store/types';
import type { RemoteHydrateOpts } from '../types/remoteHydration';
import { AppError, createAuthRequiredError, createNotFoundError } from '../services/supabase/errors';
import { rethrowUseCaseError } from './errors';
import { runGatedMatchesHydration } from './remoteHydrationGate';
import { withOptimisticMatch } from './optimisticMutation';

type MatchesDeps = {
  getRemoteUserId: () => string | null;
  getLocalMatch: (matchId: string) => Match | undefined;
  mergeHydratedRemoteMatches: (graphs: MatchGraphPayload[]) => void;
  mergeRemoteGraph: (graph: MatchGraphPayload) => void;
  createLocalMatch: (input: CreateMatchInput) => Match;
  patchLocalMatch: (matchId: string, patch: Partial<Match>) => void;
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
    lineupSlotsA?: (string | null)[] | null,
    lineupSlotsB?: (string | null)[] | null,
  ) => void;
  lockLocalLineup: (matchId: string) => void;
  unlockLocalLineup: (matchId: string) => void;
  setLocalMatchStatus: (matchId: string, status: MatchStatus) => void;
  submitLocalScore: (matchId: string, result: ScoreResult) => void;
  getMatchesSnapshot: () => Match[];
  restoreMatchesSnapshot: (snapshot: Match[]) => void;
  getPlayersSnapshot: () => Player[];
  restorePlayersSnapshot: (snapshot: Player[]) => void;
  onHydrationPage: (nextCursor: import('../services/supabase/matchGraph').MatchGraphPageCursor | null, hasMore: boolean) => void;
};

export async function hydrateRemoteMatchesUseCase(
  deps: MatchesDeps,
  opts?: RemoteHydrateOpts,
): Promise<void> {
  const uid = deps.getRemoteUserId();
  if (!uid) return;
  await runGatedMatchesHydration(opts, async () => {
    try {
      const { graphs, nextCursor } = await fetchMyMatchesGraphPage(null, MATCH_PAGE_SIZE);
      deps.mergeHydratedRemoteMatches(graphs);
      deps.onHydrationPage(nextCursor, nextCursor !== null);
    } catch (error) {
      rethrowUseCaseError('hydrateRemoteMatches', error, 'Maclar yenilenemedi. Lutfen tekrar deneyin.');
    }
  });
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

export async function updateMatchDetailsUseCase(
  deps: MatchesDeps,
  input: EditMatchInput,
): Promise<void> {
  const startsMs = new Date(input.startsAt).getTime();
  if (!Number.isFinite(startsMs) || startsMs < Date.now()) {
    throw new AppError({
      code: 'VALIDATION',
      operation: 'updateMatchDetails',
      translationKey: 'errors.rpc.matchStartsAtPast',
      retryable: false,
    });
  }

  const uid = deps.getRemoteUserId();
  if (uid && isRemoteMatchId(input.matchId)) {
    try {
      await updateMatchDetailsRemote({
        matchId: input.matchId,
        startsAt: input.startsAt,
        venue: input.venue,
        maxPlayers: input.maxPlayers,
        paymentMethod: input.paymentMethod,
        pricePerPerson: input.pricePerPerson ?? null,
        iban: input.iban ?? null,
        ibanAccountName: input.ibanAccountName ?? null,
        paymentNote: input.paymentNote ?? null,
      });
      const graph = await fetchMatchGraph(input.matchId);
      deps.mergeRemoteGraph(graph);
    } catch (error) {
      rethrowUseCaseError('updateMatchDetails', error, 'Maç güncellenemedi.');
    }
    return;
  }

  deps.patchLocalMatch(input.matchId, {
    venue: input.venue,
    startsAt: input.startsAt,
    maxPlayers: input.maxPlayers,
    paymentMethod: input.paymentMethod,
    pricePerPerson: input.pricePerPerson,
    iban: input.iban,
    ibanAccountName: input.ibanAccountName,
    paymentNote: input.paymentNote,
  });
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
    const uid = deps.getRemoteUserId();
    const patch = () => updateMatchAttendeeRemote(matchId, playerId, { status });
    await withOptimisticMatch({
      applyOptimistic: () => deps.setLocalRsvp(matchId, playerId, status),
      rpc: async () => {
        try {
          await patch();
        } catch (e) {
          if (e instanceof AppError && e.code === 'NOT_FOUND' && uid && playerId === uid) {
            const m = deps.getLocalMatch(matchId);
            if (__DEV__) {
              console.warn('[setRsvpUseCase] attendee row missing; attempting join heal', {
                matchId,
                playerId,
                attendeePlayerIds: m?.attendees?.map((a) => a.playerId),
              });
            }
            if (m?.joinCode) {
              const mid = await joinMatchByJoinCodeRpc(m.joinCode);
              if (mid === matchId) {
                await patch();
                return;
              }
            }
          }
          throw e;
        }
      },
      getSnapshot: deps.getMatchesSnapshot,
      restoreSnapshot: deps.restoreMatchesSnapshot,
    });
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
    await withOptimisticMatch({
      applyOptimistic: () => deps.setLocalPaid(matchId, playerId, paid, actorId),
      rpc: () => updateMatchAttendeeRemote(matchId, playerId, { paid }),
      getSnapshot: deps.getMatchesSnapshot,
      restoreSnapshot: deps.restoreMatchesSnapshot,
    });
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
    await withOptimisticMatch({
      applyOptimistic: () => deps.setLocalSelfReportEnabled(matchId, enabled),
      rpc: () => updateMatchOrganizerFieldsRemote(matchId, { self_report_enabled: enabled }),
      getSnapshot: deps.getMatchesSnapshot,
      restoreSnapshot: deps.restoreMatchesSnapshot,
    });
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
    await withOptimisticMatch({
      applyOptimistic: () => deps.addLocalSelfReport(matchId, playerId, type),
      rpc: () => insertSelfReportRemote(matchId, playerId, type),
      getSnapshot: deps.getMatchesSnapshot,
      restoreSnapshot: deps.restoreMatchesSnapshot,
    });
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
    await withOptimisticMatch({
      applyOptimistic: () => deps.respondLocalSelfReport(matchId, requestId, approve),
      rpc: () => updateSelfReportStatusRemote(requestId, approve ? 'approved' : 'rejected'),
      getSnapshot: deps.getMatchesSnapshot,
      restoreSnapshot: deps.restoreMatchesSnapshot,
      getPlayersSnapshot: deps.getPlayersSnapshot,
      restorePlayersSnapshot: deps.restorePlayersSnapshot,
    });
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
  lineupSlotsA?: (string | null)[] | null,
  lineupSlotsB?: (string | null)[] | null,
): Promise<void> {
  if (deps.getRemoteUserId() && isRemoteMatchId(matchId)) {
    await withOptimisticMatch({
      applyOptimistic: () =>
        deps.setLocalMatchTeams(matchId, teamAIds, teamBIds, lineupFormationId, lineupSlotsA, lineupSlotsB),
      rpc: () => replaceMatchTeamPlayersRemote(matchId, teamAIds, teamBIds),
      getSnapshot: deps.getMatchesSnapshot,
      restoreSnapshot: deps.restoreMatchesSnapshot,
    });
    return;
  }
  deps.setLocalMatchTeams(matchId, teamAIds, teamBIds, lineupFormationId, lineupSlotsA, lineupSlotsB);
}

export async function lockLineupUseCase(deps: MatchesDeps, matchId: string): Promise<void> {
  if (deps.getRemoteUserId() && isRemoteMatchId(matchId)) {
    await withOptimisticMatch({
      applyOptimistic: () => deps.lockLocalLineup(matchId),
      rpc: () => updateMatchOrganizerFieldsRemote(matchId, { lineup_locked: true }),
      getSnapshot: deps.getMatchesSnapshot,
      restoreSnapshot: deps.restoreMatchesSnapshot,
    });
    return;
  }
  deps.lockLocalLineup(matchId);
}

export async function unlockLineupUseCase(deps: MatchesDeps, matchId: string): Promise<void> {
  if (deps.getRemoteUserId() && isRemoteMatchId(matchId)) {
    await withOptimisticMatch({
      applyOptimistic: () => deps.unlockLocalLineup(matchId),
      rpc: () => updateMatchOrganizerFieldsRemote(matchId, { lineup_locked: false }),
      getSnapshot: deps.getMatchesSnapshot,
      restoreSnapshot: deps.restoreMatchesSnapshot,
    });
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
    await withOptimisticMatch({
      applyOptimistic: () => deps.setLocalMatchStatus(matchId, status),
      rpc: () => updateMatchOrganizerFieldsRemote(matchId, { status }),
      getSnapshot: deps.getMatchesSnapshot,
      restoreSnapshot: deps.restoreMatchesSnapshot,
    });
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
    await withOptimisticMatch({
      applyOptimistic: () => deps.submitLocalScore(matchId, result),
      rpc: () =>
        submitMatchResultRpc({
          matchId,
          scoreA: result.scoreA,
          scoreB: result.scoreB,
          scorers: payload.scorers,
          assists: payload.assists,
          ownGoals: payload.own_goals,
        }),
      getSnapshot: deps.getMatchesSnapshot,
      restoreSnapshot: deps.restoreMatchesSnapshot,
      getPlayersSnapshot: deps.getPlayersSnapshot,
      restorePlayersSnapshot: deps.restorePlayersSnapshot,
    });
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

  // Validate score range (0-100)
  for (const ratingInput of args.scores) {
    if (ratingInput.score < 0 || ratingInput.score > 100) {
      throw new Error('ERR_RATING_SCORE_RANGE');
    }
  }

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
