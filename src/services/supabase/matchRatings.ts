import { getSupabaseClient } from '../../lib/supabase';
import { mapSupabaseError } from './errors';

export interface MatchRatingPlayerSummaryDb {
  player_id: string;
  avg: number | null;
  votes_count: number;
  overall_avg?: number | null;
  overall_votes_count?: number;
  overall_motm_count?: number;
}

export interface MatchMotmRankDb {
  player_id: string;
  votes: number;
}

export interface MatchRatingPublicSummaryDb {
  players: MatchRatingPlayerSummaryDb[];
  motm: MatchMotmRankDb[];
}

export interface PeerRatingInput {
  ratee_id: string;
  score: number;
}

/** Tamamlanmış maç için soy ağacından (kadro ∪ katılımcı) çıkarım; oy verme için sadece kadro kullanılır sunucuda. */
export async function fetchMatchRatingPublicSummary(
  matchId: string,
): Promise<MatchRatingPublicSummaryDb | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_match_rating_public_summary', {
    p_match_id: matchId,
  });
  if (error) throw mapSupabaseError(error, 'fetchMatchRatingPublicSummary');
  if (data == null) return null;
  const raw = data as MatchRatingPublicSummaryDb;
  return {
    players: Array.isArray(raw.players) ? raw.players : [],
    motm: Array.isArray(raw.motm) ? raw.motm : [],
  };
}

export async function upsertMatchPeerRatingsRemote(matchId: string, scores: PeerRatingInput[]): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('upsert_match_peer_ratings', {
    p_match_id: matchId,
    p_scores: scores,
  });
  if (error) throw mapSupabaseError(error, 'upsertMatchPeerRatingsRemote');
}

export async function submitMatchRatingsBundleRemote(
  matchId: string,
  scores: PeerRatingInput[],
  motmPickPlayerId: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('submit_match_ratings_bundle', {
    p_match_id: matchId,
    p_scores: scores,
    p_motm_pick_player_id: motmPickPlayerId,
  });
  if (error) throw mapSupabaseError(error, 'submitMatchRatingsBundleRemote');
}

export async function upsertMatchMotmVoteRemote(matchId: string, pickPlayerId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('upsert_match_motm_vote', {
    p_match_id: matchId,
    p_pick_player_id: pickPlayerId,
  });
  if (error) throw mapSupabaseError(error, 'upsertMatchMotmVoteRemote');
}

export async function fetchMyPeerRatingsForMatch(
  matchId: string,
): Promise<PeerRatingInput[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('match_peer_ratings')
    .select('ratee_id, score')
    .eq('match_id', matchId);
  if (error) throw mapSupabaseError(error, 'fetchMyPeerRatingsForMatch');
  const rows = (data ?? []) as { ratee_id: string; score: number }[];
  return rows.map((r) => ({ ratee_id: r.ratee_id, score: r.score }));
}

export async function fetchMyMotmPickForMatch(matchId: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('match_motm_votes')
    .select('pick_player_id')
    .eq('match_id', matchId)
    .maybeSingle();
  if (error) throw mapSupabaseError(error, 'fetchMyMotmPickForMatch');
  const row = data as { pick_player_id: string } | null;
  return row?.pick_player_id ?? null;
}

export type MatchRatingDrafts = {
  peerRatings: PeerRatingInput[];
  motmPickPlayerId: string | null;
};

/** Tek RPC ile kullanıcının bu maç için peer + MOTM taslakları (görünürlük RLS ile uyumlu). */
export async function fetchMyMatchRatingDraftsForMatch(matchId: string): Promise<MatchRatingDrafts> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_my_match_rating_drafts_for_user', {
    p_match_id: matchId,
  });

  if (error) {
    const msg = error.message ?? '';
    if (
      error.code === 'PGRST202' ||
      /could not find the function/i.test(msg) ||
      /function .* does not exist/i.test(msg)
    ) {
      const [peerRatings, motmPickPlayerId] = await Promise.all([
        fetchMyPeerRatingsForMatch(matchId),
        fetchMyMotmPickForMatch(matchId),
      ]);
      return { peerRatings, motmPickPlayerId };
    }
    throw mapSupabaseError(error, 'fetchMyMatchRatingDraftsForMatch');
  }

  const rows = (Array.isArray(data) ? data : data ? [data] : []) as {
    peer_scores?: unknown;
    motm_pick?: string | null;
  }[];

  if (rows.length === 0) {
    return { peerRatings: [], motmPickPlayerId: null };
  }

  const row = rows[0]!;
  const peerRaw = row.peer_scores;
  let peerRatings: PeerRatingInput[] = [];
  if (Array.isArray(peerRaw)) {
    peerRatings = peerRaw.map((x) => {
      const o = x as { ratee_id: string; score: number };
      return { ratee_id: o.ratee_id, score: Number(o.score) };
    });
  }

  return {
    peerRatings,
    motmPickPlayerId: row.motm_pick ?? null,
  };
}
