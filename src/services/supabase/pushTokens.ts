import { getSupabaseClient } from '../../lib/supabase';

export async function upsertPushToken(token: string, platform: string): Promise<void> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: user.id,
      token,
      platform,
      is_active: true,
    },
    { onConflict: 'user_id,token' },
  );
  if (error) throw error;
}

export async function deactivatePushToken(token: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('push_tokens').update({ is_active: false }).eq('token', token);
  if (error) throw error;
}
