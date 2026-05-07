import type {
  Attendee,
  Match,
  MatchStatus,
  RSVPStatus,
  ScoreResult,
  SelfReportApprovalStatus,
  SelfReportRequest,
  SelfReportType,
  StatLine,
} from '../../types/domain';
import type {
  MatchAttendeeRow,
  MatchRow,
  MatchStatLineRow,
  MatchTeamPlayerRow,
  PublicProfileRow,
  RsvpStatusRow,
  SelfReportRequestRow,
  SelfReportStatusRow,
  SelfReportTypeRow,
} from './types';
import { fetchMatchesForCurrentUser } from './matches';
import { fetchProfilesByIds } from './profiles';
import { getSupabaseClient } from '../../lib/supabase';
import { createNotFoundError, mapSupabaseError } from './errors';

export function rsvpFromDb(row: RsvpStatusRow): RSVPStatus {
  if (row === 'not_going') return 'notGoing';
  return row;
}

export function rsvpToDb(status: RSVPStatus): RsvpStatusRow {
  if (status === 'notGoing') return 'not_going';
  return status;
}

function numOrUndef(n: number | null | undefined): number | undefined {
  if (n === null || n === undefined) return undefined;
  const x = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(x) ? x : undefined;
}

function mapSelfReportStatus(s: SelfReportStatusRow): SelfReportApprovalStatus {
  return s;
}

function mapSelfReportType(t: SelfReportTypeRow): SelfReportType {
  return t;
}

export function rowsToMatch(
  row: MatchRow,
  attendees: MatchAttendeeRow[],
  teamPlayers: MatchTeamPlayerRow[],
  statLines: MatchStatLineRow[],
  selfReports: SelfReportRequestRow[],
): Match {
  const teamAIds = teamPlayers.filter((t) => t.team === 'A').map((t) => t.player_id);
  const teamBIds = teamPlayers.filter((t) => t.team === 'B').map((t) => t.player_id);

  const domainAttendees: Attendee[] = attendees.map((a) => ({
    playerId: a.player_id,
    status: rsvpFromDb(a.status),
    paid: a.paid,
  }));

  let result: ScoreResult | undefined;
  if (row.status === 'finished' && row.score_a != null && row.score_b != null) {
    const scorers: StatLine[] = statLines
      .filter((l) => l.kind === 'goal')
      .map((l) => ({ playerId: l.player_id, count: l.count }));
    const assists: StatLine[] = statLines
      .filter((l) => l.kind === 'assist')
      .map((l) => ({ playerId: l.player_id, count: l.count }));
    result = {
      scoreA: row.score_a,
      scoreB: row.score_b,
      scorers,
      assists,
    };
  }

  const domainSelf: SelfReportRequest[] = selfReports.map((r) => ({
    id: r.id,
    matchId: r.match_id,
    playerId: r.player_id,
    type: mapSelfReportType(r.type),
    status: mapSelfReportStatus(r.status),
  }));

  const price = numOrUndef(row.price_per_person);

  return {
    id: row.id,
    groupId: row.group_id ?? undefined,
    startsAt: row.starts_at,
    venue: row.venue,
    organizerId: row.organizer_id,
    maxPlayers: row.max_players,
    pricePerPerson: price !== undefined ? price : undefined,
    iban: row.iban ?? undefined,
    joinCode: row.join_code,
    attendees: domainAttendees,
    teamAIds,
    teamBIds,
    lineupLocked: row.lineup_locked,
    selfReportEnabled: row.self_report_enabled,
    status: row.status as MatchStatus,
    result,
    selfReports: domainSelf,
  };
}

type NestedMatchRow = MatchRow & {
  match_attendees?: MatchAttendeeRow[] | null;
  match_team_players?: MatchTeamPlayerRow[] | null;
  match_stat_lines?: MatchStatLineRow[] | null;
  self_report_requests?: SelfReportRequestRow[] | null;
};

type MatchGraphRpcRow = MatchRow & {
  attendees?: MatchAttendeeRow[] | null;
  team_players?: MatchTeamPlayerRow[] | null;
  stat_lines?: MatchStatLineRow[] | null;
  self_reports?: SelfReportRequestRow[] | null;
  profiles?: PublicProfileRow[] | null;
};

function collectProfileIds(
  row: NestedMatchRow,
  attendees: MatchAttendeeRow[],
  teamPlayers: MatchTeamPlayerRow[],
  statLines: MatchStatLineRow[],
  selfReports: SelfReportRequestRow[],
): string[] {
  const ids = new Set<string>();
  ids.add(row.organizer_id);
  for (const a of attendees) ids.add(a.player_id);
  for (const t of teamPlayers) ids.add(t.player_id);
  for (const s of statLines) ids.add(s.player_id);
  for (const r of selfReports) ids.add(r.player_id);
  return [...ids];
}

export type MatchGraphPayload = {
  match: Match;
  profiles: PublicProfileRow[];
};

function jsonArrayOrEmpty<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

let matchGraphRpcSuccessCount = 0;
let matchGraphRpcFallbackCount = 0;

export async function fetchMatchGraph(matchId: string): Promise<MatchGraphPayload> {
  const supabase = getSupabaseClient();
  const [matchRes, attendeesRes, teamsRes, statsRes, selfReportsRes] = await Promise.all([
    supabase.rpc('get_match_detail_for_user', { p_match_id: matchId }),
    supabase
      .from('match_attendees')
      .select('match_id,player_id,status,paid')
      .eq('match_id', matchId),
    supabase
      .from('match_team_players')
      .select('match_id,player_id,team')
      .eq('match_id', matchId),
    supabase
      .from('match_stat_lines')
      .select('match_id,player_id,kind,count')
      .eq('match_id', matchId),
    supabase
      .from('self_report_requests')
      .select('id,match_id,player_id,type,status,created_at')
      .eq('match_id', matchId),
  ]);

  if (matchRes.error) throw mapSupabaseError(matchRes.error, 'fetchMatchGraph.match_detail');
  if (attendeesRes.error) throw mapSupabaseError(attendeesRes.error, 'fetchMatchGraph.attendees');
  if (teamsRes.error) throw mapSupabaseError(teamsRes.error, 'fetchMatchGraph.team_players');
  if (statsRes.error) throw mapSupabaseError(statsRes.error, 'fetchMatchGraph.stat_lines');
  if (selfReportsRes.error) throw mapSupabaseError(selfReportsRes.error, 'fetchMatchGraph.self_reports');

  const matchData = Array.isArray(matchRes.data) ? matchRes.data[0] : matchRes.data;
  if (!matchData) throw createNotFoundError('fetchMatchGraph', 'Maç bulunamadı');

  const row = matchData as NestedMatchRow;
  const attendees = (attendeesRes.data ?? []) as MatchAttendeeRow[];
  const teamPlayers = (teamsRes.data ?? []) as MatchTeamPlayerRow[];
  const statLines = (statsRes.data ?? []) as MatchStatLineRow[];
  const selfReports = (selfReportsRes.data ?? []) as SelfReportRequestRow[];

  const profileIds = collectProfileIds(row, attendees, teamPlayers, statLines, selfReports);
  const profiles = await fetchProfilesByIds(profileIds);
  const match = rowsToMatch(row, attendees, teamPlayers, statLines, selfReports);

  return { match, profiles };
}

export async function fetchMyMatchesGraph(): Promise<MatchGraphPayload[]> {
  const startedAt = Date.now();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('list_visible_match_graphs_for_user');
  if (error) {
    // Safe rollout fallback: keep existing behavior if new RPC is not yet applied in DB.
    matchGraphRpcFallbackCount += 1;
    console.warn('[matchGraph] list_visible_match_graphs_for_user failed; fallback enabled', {
      fallbackCount: matchGraphRpcFallbackCount,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    const summaries = await fetchMatchesForCurrentUser();
    const graphs = await Promise.all(summaries.map((s) => fetchMatchGraph(s.id)));
    console.info('[matchGraph] fallback fetch completed', {
      matchCount: graphs.length,
      durationMs: Date.now() - startedAt,
    });
    return graphs;
  }

  matchGraphRpcSuccessCount += 1;
  const rows = (data ?? []) as MatchGraphRpcRow[];
  const graphs = rows.map((row) => {
    const attendees = jsonArrayOrEmpty(row.attendees);
    const teamPlayers = jsonArrayOrEmpty(row.team_players);
    const statLines = jsonArrayOrEmpty(row.stat_lines);
    const selfReports = jsonArrayOrEmpty(row.self_reports);
    const profiles = jsonArrayOrEmpty(row.profiles);
    const match = rowsToMatch(row, attendees, teamPlayers, statLines, selfReports);
    return { match, profiles };
  });
  if (matchGraphRpcSuccessCount === 1 || matchGraphRpcSuccessCount % 10 === 0) {
    console.info('[matchGraph] rpc fetch completed', {
      successCount: matchGraphRpcSuccessCount,
      matchCount: graphs.length,
      durationMs: Date.now() - startedAt,
    });
  }
  return graphs;
}

/** RPC `submit_match_result` için gövde (onaylı self-report birleştirmesi sunucuda). */
export function scoreResultToRpcPayload(result: ScoreResult) {
  return {
    scorers: result.scorers.map((l) => ({ player_id: l.playerId, count: l.count })),
    assists: result.assists.map((l) => ({ player_id: l.playerId, count: l.count })),
  };
}
