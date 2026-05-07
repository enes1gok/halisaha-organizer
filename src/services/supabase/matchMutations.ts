import type { MatchStatus, RSVPStatus, SelfReportType } from '../../types/domain';
import { getSupabaseClient } from '../../lib/supabase';
import type { MatchStatusRow, SelfReportStatusRow } from './types';
import { rsvpToDb } from './matchGraph';

export async function updateMatchAttendeeRemote(
  matchId: string,
  playerId: string,
  patch: { status?: RSVPStatus; paid?: boolean },
): Promise<void> {
  const supabase = getSupabaseClient();
  const row: Record<string, unknown> = {};
  if (patch.status !== undefined) row.status = rsvpToDb(patch.status);
  if (patch.paid !== undefined) row.paid = patch.paid;
  const { error } = await supabase
    .from('match_attendees')
    .update(row)
    .eq('match_id', matchId)
    .eq('player_id', playerId);
  if (error) throw error;
}

export async function replaceMatchTeamPlayersRemote(
  matchId: string,
  teamAIds: string[],
  teamBIds: string[],
): Promise<void> {
  const supabase = getSupabaseClient();
  const del = await supabase.from('match_team_players').delete().eq('match_id', matchId);
  if (del.error) throw del.error;

  const rows = [
    ...teamAIds.map((player_id) => ({ match_id: matchId, player_id, team: 'A' as const })),
    ...teamBIds.map((player_id) => ({ match_id: matchId, player_id, team: 'B' as const })),
  ];
  if (rows.length === 0) return;

  const ins = await supabase.from('match_team_players').insert(rows);
  if (ins.error) throw ins.error;
}

export async function updateMatchOrganizerFieldsRemote(
  matchId: string,
  patch: Partial<{
    lineup_locked: boolean;
    self_report_enabled: boolean;
    status: MatchStatus;
  }>,
): Promise<void> {
  const supabase = getSupabaseClient();
  const dbPatch: Record<string, unknown> = {};
  if (patch.lineup_locked !== undefined) dbPatch.lineup_locked = patch.lineup_locked;
  if (patch.self_report_enabled !== undefined) dbPatch.self_report_enabled = patch.self_report_enabled;
  if (patch.status !== undefined) dbPatch.status = patch.status as MatchStatusRow;

  const { error } = await supabase.from('matches').update(dbPatch).eq('id', matchId);
  if (error) throw error;
}

export async function insertSelfReportRemote(
  matchId: string,
  playerId: string,
  type: SelfReportType,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('self_report_requests').insert({
    match_id: matchId,
    player_id: playerId,
    type,
    status: 'pending',
  });
  if (error) throw error;
}

export async function updateSelfReportStatusRemote(
  requestId: string,
  status: SelfReportStatusRow,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('self_report_requests').update({ status }).eq('id', requestId);
  if (error) throw error;
}
