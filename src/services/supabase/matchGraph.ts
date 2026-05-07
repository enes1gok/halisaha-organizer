import type { Match } from '../../types/domain';
import type {
  MatchAttendeeRow,
  MatchRow,
  MatchStatLineRow,
  MatchTeamPlayerRow,
  PublicProfileRow,
  SelfReportRequestRow,
} from './types';
import { fetchMatchesForCurrentUser } from './matches';
import { fetchProfilesByIds } from './profiles';
import { getSupabaseClient } from '../../lib/supabase';
import { createNotFoundError, mapSupabaseError } from './errors';
import { jsonArrayOrEmpty, rowsToMatch } from './mappers';

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

let matchGraphRpcSuccessCount = 0;
let matchGraphRpcFallbackCount = 0;
let matchGraphDetailRpcSuccessCount = 0;
let matchGraphDetailRpcFallbackCount = 0;

export async function fetchMatchGraph(matchId: string): Promise<MatchGraphPayload> {
  const supabase = getSupabaseClient();
  const startedAt = Date.now();

  // Prefer the consolidated single-RPC path (1 round-trip). If the RPC is
  // not yet deployed or fails, fall back to the legacy 6-query path so we
  // can ship the client and migration independently.
  const { data, error } = await supabase.rpc('get_match_graph_for_user', { p_match_id: matchId });
  if (!error) {
    matchGraphDetailRpcSuccessCount += 1;
    const row = (Array.isArray(data) ? data[0] : data) as MatchGraphRpcRow | undefined;
    if (!row) throw createNotFoundError('fetchMatchGraph', 'Maç bulunamadı');
    const attendees = jsonArrayOrEmpty(row.attendees);
    const teamPlayers = jsonArrayOrEmpty(row.team_players);
    const statLines = jsonArrayOrEmpty(row.stat_lines);
    const selfReports = jsonArrayOrEmpty(row.self_reports);
    const profiles = jsonArrayOrEmpty(row.profiles);
    const match = rowsToMatch(row, attendees, teamPlayers, statLines, selfReports);
    if (matchGraphDetailRpcSuccessCount === 1 || matchGraphDetailRpcSuccessCount % 10 === 0) {
      console.info('[matchGraph] detail rpc fetch completed', {
        successCount: matchGraphDetailRpcSuccessCount,
        durationMs: Date.now() - startedAt,
      });
    }
    return { match, profiles };
  }

  matchGraphDetailRpcFallbackCount += 1;
  console.warn('[matchGraph] get_match_graph_for_user failed; fallback enabled', {
    fallbackCount: matchGraphDetailRpcFallbackCount,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });

  return fetchMatchGraphLegacy(matchId);
}

async function fetchMatchGraphLegacy(matchId: string): Promise<MatchGraphPayload> {
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
