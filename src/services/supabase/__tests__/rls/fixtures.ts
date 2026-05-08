import type { SupabaseClient } from '@supabase/supabase-js';

export type InsertedMatch = {
  id: string;
  join_code: string;
};

/**
 * Creates an upcoming match as the signed-in organizer (`create_match_with_organizer_attendee` RPC).
 */
export async function insertMatchAsOrganizer(
  organizer: SupabaseClient,
  joinCode: string,
): Promise<InsertedMatch> {
  const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const { data, error } = await organizer.rpc('create_match_with_organizer_attendee', {
    p_starts_at: startsAt,
    p_venue: 'RLS integration sahası',
    p_max_players: 14,
    p_join_code: joinCode,
    p_group_id: null,
    p_price_per_person: null,
    p_iban: null,
  });

  if (error) throw error;

  const row = data as { id?: string; join_code?: string } | null;
  if (!row?.id || !row.join_code) throw new Error('insertMatchAsOrganizer: no row');

  return { id: row.id, join_code: row.join_code };
}

/** Gruba bağlı maç (haftalık spawn testleri için). */
export async function insertGroupMatchAsOrganizer(
  organizer: SupabaseClient,
  joinCode: string,
  groupId: string,
  startsAtIso: string,
): Promise<InsertedMatch> {
  const { data, error } = await organizer.rpc('create_match_with_organizer_attendee', {
    p_starts_at: startsAtIso,
    p_venue: 'Grup serisi sahası',
    p_max_players: 14,
    p_join_code: joinCode,
    p_group_id: groupId,
    p_price_per_person: null,
    p_iban: null,
  });

  if (error) throw error;

  const row = data as { id?: string; join_code?: string } | null;
  if (!row?.id || !row.join_code) throw new Error('insertGroupMatchAsOrganizer: no row');

  return { id: row.id, join_code: row.join_code };
}
