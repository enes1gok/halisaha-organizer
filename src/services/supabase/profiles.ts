import { getSupabaseClient } from '../../lib/supabase';
import type { PlayerPositionRow, PreferredFootRow, ProfileRow } from './types';

export async function fetchProfilesByIds(ids: string[]): Promise<ProfileRow[]> {
  const uniq = [...new Set(ids)].filter(Boolean);
  if (uniq.length === 0) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('profiles').select('*').in('id', uniq);
  if (error) throw error;
  return (data ?? []) as ProfileRow[];
}

export async function fetchProfileById(playerId: string): Promise<ProfileRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', playerId).maybeSingle();
  if (error) throw error;
  return data as ProfileRow | null;
}

export async function fetchCurrentUserProfile(): Promise<ProfileRow | null> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return fetchProfileById(user.id);
}

export type ProfileUpdate = Partial<{
  display_name: string;
  photo_uri: string | null;
  position: PlayerPositionRow;
  preferred_foot: PreferredFootRow;
  iban: string | null;
}>;

export async function updateCurrentUserProfile(patch: ProfileUpdate): Promise<ProfileRow> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Oturum gerekli');

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select('*')
    .single();
  if (error) throw error;
  return data as ProfileRow;
}
