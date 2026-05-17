import type { Position } from '../../types/domain';
import { getSupabaseClient } from '../../lib/supabase';
import { createAuthRequiredError, mapSupabaseError } from './errors';
import { mapGuestAttendeeRow } from './mappers';
import type { MatchGuestAttendeeRow, MatchGuestTeamAssignmentRow } from './types';

export async function addMatchGuestRemote(
  matchId: string,
  displayName: string,
  position: Position,
): Promise<MatchGuestAttendeeRow> {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw createAuthRequiredError('addMatchGuestRemote');
  const { data, error } = await supabase.rpc('add_match_guest', {
    p_match_id: matchId,
    p_display_name: displayName,
    p_position: position,
  });
  if (error) throw mapSupabaseError(error, 'addMatchGuestRemote');
  return data as MatchGuestAttendeeRow;
}

export async function removeMatchGuestRemote(guestId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('remove_match_guest', { p_guest_id: guestId });
  if (error) throw mapSupabaseError(error, 'removeMatchGuestRemote');
}

export async function updateGuestPaidRemote(guestId: string, paid: boolean): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('match_guest_attendees')
    .update({ paid })
    .eq('id', guestId);
  if (error) throw mapSupabaseError(error, 'updateGuestPaidRemote');
}

export async function fetchMatchGuestsRemote(matchId: string): Promise<{
  guests: MatchGuestAttendeeRow[];
  teamAssignments: MatchGuestTeamAssignmentRow[];
}> {
  const supabase = getSupabaseClient();
  const [guestsRes, teamsRes] = await Promise.all([
    supabase.from('match_guest_attendees').select('*').eq('match_id', matchId),
    supabase.from('match_guest_team_assignments').select('*').eq('match_id', matchId),
  ]);
  if (guestsRes.error) throw mapSupabaseError(guestsRes.error, 'fetchMatchGuestsRemote.guests');
  if (teamsRes.error) throw mapSupabaseError(teamsRes.error, 'fetchMatchGuestsRemote.teams');
  return {
    guests: (guestsRes.data ?? []) as MatchGuestAttendeeRow[],
    teamAssignments: (teamsRes.data ?? []) as MatchGuestTeamAssignmentRow[],
  };
}

export { mapGuestAttendeeRow };
