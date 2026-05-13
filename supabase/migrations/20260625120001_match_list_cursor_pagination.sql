-- Faz 4: cursor-based keyset pagination for match list RPCs.
--
-- Adds p_after_starts_at + p_after_id parameters to both list functions so
-- clients can fetch pages instead of the full list.
--
-- Backward compat: existing calls with only p_limit continue to work via
-- defaults (p_after_starts_at = null → no cursor → first page).
--
-- Keyset order: starts_at DESC, id DESC
-- Cursor "give me rows after (starts_at, id)":
--   WHERE (mg.starts_at < p_after_starts_at)
--      OR (mg.starts_at = p_after_starts_at AND mg.id < p_after_id)
--
-- Per supabase-schema-evolution.md: adding parameters requires DROP + recreate
-- because CREATE OR REPLACE treats new parameter signatures as a different
-- function OID.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. list_visible_match_graphs_for_user
-- ─────────────────────────────────────────────────────────────────────────────

drop function if exists public.list_visible_match_graphs_for_user(integer);

create function public.list_visible_match_graphs_for_user(
  p_limit integer default null,
  p_after_starts_at timestamptz default null,
  p_after_id uuid default null
)
returns table (
  id uuid,
  starts_at timestamptz,
  venue text,
  organizer_id uuid,
  max_players int,
  price_per_person numeric,
  iban text,
  iban_account_name text,
  payment_note text,
  payment_method text,
  join_code text,
  lineup_locked boolean,
  self_report_enabled boolean,
  status public.match_status,
  score_a int,
  score_b int,
  group_id uuid,
  series_id uuid,
  spawned_from_match_id uuid,
  attendees jsonb,
  team_players jsonb,
  stat_lines jsonb,
  self_reports jsonb,
  profiles jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select mg.*
  from public.matches m
  cross join lateral public.match_graph_row_body(m.id) as mg
  where public.can_view_match(m.id, auth.uid())
    and (
      p_after_starts_at is null
      or mg.starts_at < p_after_starts_at
      or (mg.starts_at = p_after_starts_at and mg.id < p_after_id)
    )
  order by mg.starts_at desc, mg.id desc
  limit p_limit;
$$;

revoke execute on function public.list_visible_match_graphs_for_user(integer, timestamptz, uuid) from public;
revoke execute on function public.list_visible_match_graphs_for_user(integer, timestamptz, uuid) from anon;
grant execute on function public.list_visible_match_graphs_for_user(integer, timestamptz, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. list_visible_match_summaries_for_user
-- ─────────────────────────────────────────────────────────────────────────────

drop function if exists public.list_visible_match_summaries_for_user(integer);

create function public.list_visible_match_summaries_for_user(
  p_limit integer default null,
  p_after_starts_at timestamptz default null,
  p_after_id uuid default null
)
returns table (
  id uuid,
  starts_at timestamptz,
  venue text,
  organizer_id uuid,
  max_players int,
  price_per_person numeric,
  iban text,
  iban_account_name text,
  payment_note text,
  payment_method text,
  join_code text,
  lineup_locked boolean,
  self_report_enabled boolean,
  status public.match_status,
  score_a int,
  score_b int,
  group_id uuid,
  series_id uuid,
  spawned_from_match_id uuid,
  attendees jsonb,
  team_players jsonb,
  stat_lines jsonb,
  self_reports jsonb,
  profiles jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select mg.*
  from public.matches m
  cross join lateral public.match_graph_row_summary_body(m.id) as mg
  where public.can_view_match(m.id, auth.uid())
    and (
      p_after_starts_at is null
      or mg.starts_at < p_after_starts_at
      or (mg.starts_at = p_after_starts_at and mg.id < p_after_id)
    )
  order by mg.starts_at desc, mg.id desc
  limit p_limit;
$$;

revoke execute on function public.list_visible_match_summaries_for_user(integer, timestamptz, uuid) from public;
revoke execute on function public.list_visible_match_summaries_for_user(integer, timestamptz, uuid) from anon;
grant execute on function public.list_visible_match_summaries_for_user(integer, timestamptz, uuid) to authenticated;
