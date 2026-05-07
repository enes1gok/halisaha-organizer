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
  ProfileRow,
  RsvpStatusRow,
  SelfReportRequestRow,
  SelfReportStatusRow,
  SelfReportTypeRow,
} from './types';
import { fetchMatchesForCurrentUser } from './matches';
import { fetchProfilesByIds } from './profiles';
import { getSupabaseClient } from '../../lib/supabase';

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
  profiles: ProfileRow[];
};

export async function fetchMatchGraph(matchId: string): Promise<MatchGraphPayload> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('matches')
    .select(
      `
      *,
      match_attendees (*),
      match_team_players (*),
      match_stat_lines (*),
      self_report_requests (*)
    `,
    )
    .eq('id', matchId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Maç bulunamadı');

  const row = data as NestedMatchRow;
  const attendees = row.match_attendees ?? [];
  const teamPlayers = row.match_team_players ?? [];
  const statLines = row.match_stat_lines ?? [];
  const selfReports = row.self_report_requests ?? [];

  const profileIds = collectProfileIds(row, attendees, teamPlayers, statLines, selfReports);
  const profiles = await fetchProfilesByIds(profileIds);
  const match = rowsToMatch(row, attendees, teamPlayers, statLines, selfReports);

  return { match, profiles };
}

export async function fetchMyMatchesGraph(): Promise<MatchGraphPayload[]> {
  const summaries = await fetchMatchesForCurrentUser();
  const graphs = await Promise.all(summaries.map((s) => fetchMatchGraph(s.id)));
  return graphs;
}

/** RPC `submit_match_result` için gövde (onaylı self-report birleştirmesi sunucuda). */
export function scoreResultToRpcPayload(result: ScoreResult) {
  return {
    scorers: result.scorers.map((l) => ({ player_id: l.playerId, count: l.count })),
    assists: result.assists.map((l) => ({ player_id: l.playerId, count: l.count })),
  };
}
