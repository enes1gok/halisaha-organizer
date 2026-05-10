/** Rozet kilidi / push bildirimi için kalıcı tablo bu katmanda yok (plan: ileride unlock veya notification_deliveries). */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlayerBadgeInputs } from '../../domain/badges';

/** RPC `get_my_player_badge_inputs` JSON gövdesi (snake_case). */
export interface PlayerBadgeInputsRpcRow {
  career_goals: number;
  career_assists: number;
  finished_matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  motm_count: number;
  goal_match_streak_current: number;
  goal_match_streak_best: number;
  avg_peer_rating_100: number | null;
  peer_rating_vote_count: number;
  max_goals_single_match: number;
  max_assists_single_match: number;
}

export function mapRpcToPlayerBadgeInputs(row: PlayerBadgeInputsRpcRow): PlayerBadgeInputs {
  return {
    careerGoals: row.career_goals,
    careerAssists: row.career_assists,
    finishedMatchesPlayed: row.finished_matches_played,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    motmCount: row.motm_count,
    goalMatchStreakCurrent: row.goal_match_streak_current,
    goalMatchStreakBest: row.goal_match_streak_best,
    avgPeerRating100: row.avg_peer_rating_100,
    peerRatingVoteCount: row.peer_rating_vote_count,
    maxGoalsSingleMatch: row.max_goals_single_match,
    maxAssistsSingleMatch: row.max_assists_single_match,
  };
}

export async function fetchMyPlayerBadgeInputs(
  supabase: SupabaseClient,
): Promise<PlayerBadgeInputs | null> {
  const { data, error } = await supabase.rpc('get_my_player_badge_inputs');
  if (error) throw error;
  if (data === null || data === undefined) return null;
  const row = data as PlayerBadgeInputsRpcRow;
  return mapRpcToPlayerBadgeInputs(row);
}
