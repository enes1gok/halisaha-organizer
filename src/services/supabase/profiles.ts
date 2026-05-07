import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { createAuthRequiredError, mapSupabaseError } from './errors';
import type { PlayerPositionRow, PreferredFootRow, ProfileRow, PublicProfileRow } from './types';

/** Creates `profiles` row for `auth.uid()` when missing (RPC is SECURITY DEFINER). No-op if Supabase env is absent. */
export async function ensureMyProfile(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('ensure_my_profile');
  if (error) throw mapSupabaseError(error, 'ensureMyProfile');
}

export async function fetchProfilesByIds(ids: string[]): Promise<PublicProfileRow[]> {
  const uniq = [...new Set(ids)].filter(Boolean);
  if (uniq.length === 0) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profiles_public')
    .select('id,display_name,photo_uri,position,preferred_foot')
    .in('id', uniq);
  if (error) throw mapSupabaseError(error, 'fetchProfilesByIds');
  return (data ?? []) as PublicProfileRow[];
}

export async function fetchProfileById(playerId: string): Promise<ProfileRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', playerId).maybeSingle();
  if (error) throw mapSupabaseError(error, 'fetchProfileById');
  return data as ProfileRow | null;
}

/** Calls `ensure_my_profile` then loads the row; ensure failure is ignored so an existing row can still be fetched. */
export async function ensureThenFetchProfile(userId: string): Promise<ProfileRow | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    await ensureMyProfile();
  } catch (e) {
    console.warn('ensure_my_profile failed', e);
  }
  return fetchProfileById(userId);
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
  if (!user) throw createAuthRequiredError('updateCurrentUserProfile');

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select('*')
    .single();
  if (error) throw mapSupabaseError(error, 'updateCurrentUserProfile');
  return data as ProfileRow;
}
