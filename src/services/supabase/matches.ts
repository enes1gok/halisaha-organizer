import { getSupabaseClient } from '../../lib/supabase';
import type { MatchRow, StatLinePayload } from './types';

export type CreateMatchRowInput = {
  startsAt: string;
  venue: string;
  maxPlayers: number;
  joinCode: string;
  pricePerPerson?: number | null;
  iban?: string | null;
};

/** Maç oluşturur ve organizatörü `going` davetli olarak ekler (yerel store ile aynı akış). */
export async function insertMatchWithOrganizerAttendee(input: CreateMatchRowInput): Promise<MatchRow> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Oturum gerekli');

  const { data: match, error } = await supabase
    .from('matches')
    .insert({
      starts_at: input.startsAt,
      venue: input.venue,
      organizer_id: user.id,
      max_players: input.maxPlayers,
      price_per_person: input.pricePerPerson ?? null,
      iban: input.iban ?? null,
      join_code: input.joinCode,
    })
    .select('*')
    .single();

  if (error) throw error;

  const ins = await supabase.from('match_attendees').insert({
    match_id: match.id,
    player_id: user.id,
    status: 'going',
    paid: false,
  });
  if (ins.error) throw ins.error;

  return match as MatchRow;
}

export async function fetchMatchById(matchId: string): Promise<MatchRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('matches').select('*').eq('id', matchId).maybeSingle();
  if (error) throw error;
  return data as MatchRow | null;
}

/** Kullanıcının organizatör olduğu veya davetli olduğu maçlar (RLS ile uyumlu). */
export async function fetchMatchesForCurrentUser(): Promise<MatchRow[]> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [organized, attending] = await Promise.all([
    supabase.from('matches').select('id').eq('organizer_id', user.id),
    supabase.from('match_attendees').select('match_id').eq('player_id', user.id),
  ]);

  if (organized.error) throw organized.error;
  if (attending.error) throw attending.error;

  const ids = new Set<string>();
  organized.data?.forEach((r) => ids.add(r.id));
  attending.data?.forEach((r) => ids.add(r.match_id));

  if (ids.size === 0) return [];

  const { data, error } = await supabase.from('matches').select('*').in('id', [...ids]);
  if (error) throw error;
  return (data ?? []) as MatchRow[];
}

export async function getMatchByJoinCodePreview(joinCode: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_match_by_join_code', { p_code: joinCode });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  return row ?? null;
}

export async function joinMatchByJoinCode(joinCode: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('join_match_by_join_code', { p_code: joinCode });
  if (error) throw error;
  return data as string | null;
}

export async function submitMatchResultRpc(params: {
  matchId: string;
  scoreA: number;
  scoreB: number;
  scorers: StatLinePayload[];
  assists: StatLinePayload[];
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('submit_match_result', {
    p_match_id: params.matchId,
    p_score_a: params.scoreA,
    p_score_b: params.scoreB,
    p_scorers: params.scorers,
    p_assists: params.assists,
  });
  if (error) throw error;
}
