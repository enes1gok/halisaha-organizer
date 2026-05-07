import { getSupabaseClient } from '../../lib/supabase';
import { mapSupabaseError } from './errors';
import type { LeaderboardMetricFilter, PlayerLeaderboardStatsRow } from './types';

export type LeaderboardTimeframe = 'all' | 'week' | 'month';

/**
 * Bitmiş maçlardan türetilen oyuncu istatistikleri (`player_leaderboard_stats` RPC).
 * Hafta/ay: Postgres `date_trunc` (ISO hafta, Pazartesi başlangıç).
 */
export async function fetchPlayerLeaderboardStats(
  timeframe: LeaderboardTimeframe = 'all',
  refIso: string = new Date().toISOString(),
  groupId: string | null = null,
  metric: LeaderboardMetricFilter = null,
): Promise<PlayerLeaderboardStatsRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('player_leaderboard_stats', {
    p_timeframe: timeframe,
    p_ref: refIso,
    p_group_id: groupId,
    p_metric: metric,
  });
  if (error) throw mapSupabaseError(error, 'fetchPlayerLeaderboardStats');
  const rows = (data ?? []) as PlayerLeaderboardStatsRow[];
  return rows.map((r) => ({
    ...r,
    goals: Number(r.goals),
    assists: Number(r.assists),
    matches_played: Number(r.matches_played),
    wins: Number(r.wins),
    losses: Number(r.losses),
    draws: Number(r.draws),
  }));
}
