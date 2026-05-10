-- Hot-path indexes: leaderboards (player_leaderboard_stats finished CTE),
-- group RSVP/payment reminder crons, enqueue_streak_at_risk_reminders (group_members + matches),
-- get_my_player_badge_inputs (match_stat_lines by player_id, kind).
--
-- Deploy: CREATE INDEX can lock the table briefly; plan a low-traffic window for very large tables.
-- Optional pre/post: EXPLAIN (ANALYZE, BUFFERS) on those query shapes (see supabase-postgres-performance).

-- A1) Finished scored matches — aligns with player_leaderboard_stats "finished" CTE filters.
create index if not exists matches_finished_group_starts_at_idx
  on public.matches (group_id, starts_at)
  where
    status = 'finished'::public.match_status
    and score_a is not null
    and score_b is not null;

-- A2) Upcoming group matches — aligns with reminder enqueue predicates on matches.
create index if not exists matches_upcoming_group_starts_at_idx
  on public.matches (group_id, starts_at)
  where
    status = 'upcoming'::public.match_status
    and group_id is not null;

-- B) Player-first group membership (complements group_members_group_user_idx on group_id, player_id).
create index if not exists group_members_player_group_idx
  on public.group_members (player_id, group_id);

-- C) RSVP lookups by player and status (streak triggers, reminder joins).
create index if not exists match_attendees_player_status_idx
  on public.match_attendees (player_id, status);

-- D) Player-scoped stat lines (badge RPC max goals/assists per match subqueries).
create index if not exists match_stat_lines_player_kind_idx
  on public.match_stat_lines (player_id, kind);
