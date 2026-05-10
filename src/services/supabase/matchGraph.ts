import type { Match } from '../../types/domain';
import { mapWithConcurrency } from '../../utils/asyncPool';
import type {
  MatchAttendeeRow,
  MatchRow,
  MatchStatLineRow,
  MatchTeamPlayerRow,
  PublicProfileRow,
  SelfReportRequestRow,
} from './types';
import { fetchMatchesForCurrentUser } from './matches';
import { reportDiagnosticMetric } from '../logging/reportError';
import {
  recordDetailMatchGraphRpcFallback,
  recordDetailMatchGraphRpcSuccess,
  recordListMatchGraphRpcFallback,
  recordListMatchGraphRpcSuccess,
} from './matchGraphRpcMonitoring';
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

/** Fallback when batch RPC is unavailable: max concurrent single-match fetches. */
const MATCH_GRAPH_FALLBACK_CONCURRENCY = 4;

const DETAIL_RPC_RETRY_DELAY_MS = 200;

let detailRpcSuccessLogCounter = 0;
let listRpcSuccessLogCounter = 0;

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

function rpcRowToPayload(row: MatchGraphRpcRow): MatchGraphPayload {
  const attendees = jsonArrayOrEmpty(row.attendees);
  const teamPlayers = jsonArrayOrEmpty(row.team_players);
  const statLines = jsonArrayOrEmpty(row.stat_lines);
  const selfReports = jsonArrayOrEmpty(row.self_reports);
  const profiles = jsonArrayOrEmpty(row.profiles);
  const match = rowsToMatch(row, attendees, teamPlayers, statLines, selfReports);
  return { match, profiles };
}

function shouldRetryMatchGraphDetailRpc(err: { code?: string; message?: string }): boolean {
  const msg = (err.message ?? '').toLowerCase();
  if (msg.includes('network') || msg.includes('fetch failed') || msg.includes('failed to fetch'))
    return true;
  if (msg.includes('timeout') || msg.includes('timed out')) return true;
  if (err.code === 'PGRST301' || err.code === 'PGRST302') return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchMatchGraph(matchId: string): Promise<MatchGraphPayload> {
  const supabase = getSupabaseClient();
  const startedAt = Date.now();

  const tryRpc = () =>
    supabase.rpc('get_match_graph_for_user', { p_match_id: matchId });

  let { data, error } = await tryRpc();
  if (error && shouldRetryMatchGraphDetailRpc(error)) {
    await sleep(DETAIL_RPC_RETRY_DELAY_MS);
    ({ data, error } = await tryRpc());
  }

  if (!error) {
    recordDetailMatchGraphRpcSuccess();
    const row = (Array.isArray(data) ? data[0] : data) as MatchGraphRpcRow | undefined;
    if (!row) throw createNotFoundError('fetchMatchGraph', 'Maç bulunamadı');
    const payload = rpcRowToPayload(row);
    detailRpcSuccessLogCounter += 1;
    if (detailRpcSuccessLogCounter === 1 || detailRpcSuccessLogCounter % 10 === 0) {
      reportDiagnosticMetric(
        'matchGraph.detailRpc.success',
        {
          successCount: detailRpcSuccessLogCounter,
          durationMs: Date.now() - startedAt,
        },
        true,
      );
    }
    return payload;
  }

  recordDetailMatchGraphRpcFallback();
  console.warn('[matchGraph] get_match_graph_for_user failed; legacy fallback', {
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

async function fetchMatchGraphsViaBatchRpc(matchIds: string[]): Promise<MatchGraphPayload[] | null> {
  if (matchIds.length === 0) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('list_match_graphs_for_match_ids', {
    p_match_ids: matchIds,
  });
  if (error) {
    console.warn('[matchGraph] list_match_graphs_for_match_ids failed', {
      code: error.code,
      message: error.message,
    });
    return null;
  }
  const rows = (data ?? []) as MatchGraphRpcRow[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered: MatchGraphPayload[] = [];
  for (const id of matchIds) {
    const row = byId.get(id);
    if (row) ordered.push(rpcRowToPayload(row));
  }
  return ordered;
}

export async function fetchMyMatchesGraph(): Promise<MatchGraphPayload[]> {
  const startedAt = Date.now();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('list_visible_match_graphs_for_user');
  if (error) {
    recordListMatchGraphRpcFallback();
    console.warn('[matchGraph] list_visible_match_graphs_for_user failed; fallback enabled', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    const summaries = await fetchMatchesForCurrentUser();
    const ids = summaries.map((s) => s.id);

    const batchPayloads = await fetchMatchGraphsViaBatchRpc(ids);
    if (batchPayloads !== null) {
      if (batchPayloads.length === ids.length) {
        console.info('[matchGraph] fallback batch RPC fetch completed', {
          matchCount: batchPayloads.length,
          durationMs: Date.now() - startedAt,
        });
        return batchPayloads;
      }
      const byId = new Map(batchPayloads.map((g) => [g.match.id, g]));
      console.warn('[matchGraph] batch RPC partial; filling missing matches', {
        requested: ids.length,
        returned: batchPayloads.length,
      });
      const merged = await mapWithConcurrency(ids, MATCH_GRAPH_FALLBACK_CONCURRENCY, async (id) => {
        const hit = byId.get(id);
        if (hit) return hit;
        return fetchMatchGraph(id);
      });
      console.info('[matchGraph] fallback batch+fill fetch completed', {
        matchCount: merged.length,
        durationMs: Date.now() - startedAt,
      });
      return merged;
    }

    const graphs = await mapWithConcurrency(ids, MATCH_GRAPH_FALLBACK_CONCURRENCY, (id) =>
      fetchMatchGraph(id),
    );
    console.info('[matchGraph] fallback per-match fetch completed', {
      matchCount: graphs.length,
      durationMs: Date.now() - startedAt,
      concurrency: MATCH_GRAPH_FALLBACK_CONCURRENCY,
    });
    return graphs;
  }

  recordListMatchGraphRpcSuccess();
  const rows = (data ?? []) as MatchGraphRpcRow[];
  const graphs = rows.map((row) => rpcRowToPayload(row));
  listRpcSuccessLogCounter += 1;
  if (listRpcSuccessLogCounter === 1 || listRpcSuccessLogCounter % 10 === 0) {
    reportDiagnosticMetric(
      'matchGraph.listRpc.success',
      {
        successCount: listRpcSuccessLogCounter,
        matchCount: graphs.length,
        durationMs: Date.now() - startedAt,
      },
      true,
    );
  }
  return graphs;
}
