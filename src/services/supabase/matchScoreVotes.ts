import type { MatchScoreVoteTally } from '../../types/domain';
import { getSupabaseClient } from '../../lib/supabase';
import { mapSupabaseError } from './errors';

interface ScoreVoteTallyRow {
  score_a: number;
  score_b: number;
  vote_weight: number;
  voter_count: number;
}

export async function fetchMatchScoreVoteTallyRemote(
  matchId: string,
): Promise<MatchScoreVoteTally[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_match_score_vote_tally', {
    p_match_id: matchId,
  });
  if (error) throw mapSupabaseError(error, 'fetchMatchScoreVoteTallyRemote');
  const rows = (Array.isArray(data) ? data : []) as ScoreVoteTallyRow[];
  return rows.map((r) => ({
    scoreA: r.score_a,
    scoreB: r.score_b,
    voteWeight: r.vote_weight,
    voterCount: r.voter_count,
  }));
}

export async function upsertMatchScoreVoteRemote(
  matchId: string,
  scoreA: number,
  scoreB: number,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('upsert_match_score_vote', {
    p_match_id: matchId,
    p_score_a: scoreA,
    p_score_b: scoreB,
  });
  if (error) throw mapSupabaseError(error, 'upsertMatchScoreVoteRemote');
}

export async function fetchMyScoreVoteForMatch(
  matchId: string,
): Promise<MatchScoreVoteTally | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('match_score_votes')
    .select('score_a, score_b')
    .eq('match_id', matchId)
    .maybeSingle();
  if (error) throw mapSupabaseError(error, 'fetchMyScoreVoteForMatch');
  if (!data) return null;
  const row = data as { score_a: number; score_b: number };
  return { scoreA: row.score_a, scoreB: row.score_b, voteWeight: 0, voterCount: 0 };
}
