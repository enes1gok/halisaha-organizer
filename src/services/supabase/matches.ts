import { getSupabaseClient } from '../../lib/supabase';
import { createAuthRequiredError, generateTraceId, mapSupabaseError } from './errors';
import type { MatchRow, StatLinePayload } from './types';

export type CreateMatchRowInput = {
  startsAt: string;
  venue: string;
  maxPlayers: number;
  joinCode: string;
  groupId?: string;
  pricePerPerson?: number | null;
  iban?: string | null;
};

/** Maç oluşturur ve organizatörü `going` davetli olarak ekler (atomik RPC; yerel store ile aynı akış). */
export async function insertMatchWithOrganizerAttendee(input: CreateMatchRowInput): Promise<MatchRow> {
  const supabase = getSupabaseClient();
  await supabase.auth.refreshSession();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw createAuthRequiredError('insertMatchWithOrganizerAttendee');

  const { data, error } = await supabase.rpc('create_match_with_organizer_attendee', {
    p_starts_at: input.startsAt,
    p_venue: input.venue,
    p_max_players: input.maxPlayers,
    p_join_code: input.joinCode,
    p_group_id: input.groupId ?? null,
    p_price_per_person: input.pricePerPerson ?? null,
    p_iban: input.iban ?? null,
  });

  if (error) throw mapSupabaseError(error, 'insertMatchWithOrganizerAttendee.create_match_rpc');

  const match = data as MatchRow | null;
  if (!match?.id) {
    throw mapSupabaseError({ message: 'create_match_with_organizer_attendee returned no row' }, 'insertMatchWithOrganizerAttendee.create_match_rpc');
  }

  return match;
}

export async function fetchMatchById(matchId: string): Promise<MatchRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_match_detail_for_user', { p_match_id: matchId });
  if (error) throw mapSupabaseError(error, 'fetchMatchById');
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as MatchRow | null;
}

/** Kullanıcının organizatör olduğu veya davetli olduğu maçlar (RLS ile uyumlu). */
export async function fetchMatchesForCurrentUser(): Promise<MatchRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('list_visible_matches_for_user');
  if (error) throw mapSupabaseError(error, 'fetchMatchesForCurrentUser');
  return (data ?? []) as MatchRow[];
}

export async function getMatchByJoinCodePreview(joinCode: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_match_by_join_code', { p_code: joinCode });
  if (error) throw mapSupabaseError(error, 'getMatchByJoinCodePreview');
  const row = Array.isArray(data) ? data[0] : null;
  return row ?? null;
}

export async function joinMatchByJoinCode(joinCode: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const traceId = generateTraceId();
  const { data, error } = await supabase.rpc('join_match_by_join_code', { p_code: joinCode });
  if (error) throw mapSupabaseError(error, 'joinMatchByJoinCode', { traceId });
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
  const traceId = generateTraceId();
  const { error } = await supabase.rpc('submit_match_result', {
    p_match_id: params.matchId,
    p_score_a: params.scoreA,
    p_score_b: params.scoreB,
    p_scorers: params.scorers,
    p_assists: params.assists,
  });
  if (error) {
    throw mapSupabaseError(error, 'submitMatchResultRpc', {
      traceId,
      requestPayload: {
        matchId: params.matchId,
        scoreA: params.scoreA,
        scoreB: params.scoreB,
        scorerLines: params.scorers.length,
        assistLines: params.assists.length,
      },
    });
  }
}
