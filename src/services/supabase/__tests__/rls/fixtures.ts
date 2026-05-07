import type { SupabaseClient } from '@supabase/supabase-js';

export type InsertedMatch = {
  id: string;
  join_code: string;
};

/**
 * Creates an upcoming match as the signed-in organizer (RLS insert + organizer attendee).
 */
export async function insertMatchAsOrganizer(
  organizer: SupabaseClient,
  joinCode: string,
  options?: { selfReportEnabled?: boolean },
): Promise<InsertedMatch> {
  const {
    data: { user },
  } = await organizer.auth.getUser();
  if (!user) throw new Error('insertMatchAsOrganizer: not signed in');

  const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const { data: match, error } = await organizer
    .from('matches')
    .insert({
      starts_at: startsAt,
      venue: 'RLS integration sahası',
      organizer_id: user.id,
      max_players: 14,
      join_code: joinCode,
      self_report_enabled: options?.selfReportEnabled ?? false,
    })
    .select('id, join_code')
    .single();

  if (error) throw error;
  if (!match) throw new Error('insertMatchAsOrganizer: no row');

  const att = await organizer.from('match_attendees').insert({
    match_id: match.id,
    player_id: user.id,
    status: 'going',
    paid: false,
  });
  if (att.error) throw att.error;

  return { id: match.id, join_code: match.join_code };
}
