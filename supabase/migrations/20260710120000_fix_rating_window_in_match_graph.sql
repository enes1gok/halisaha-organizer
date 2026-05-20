-- Fix: rating_window_ends_at missing from match-graph RPCs.
--
-- Migration 20260709120000_lineup_slot_index_and_formation.sql recreated all
-- match-graph functions to add lineup_formation_id and slot_index support, but
-- accidentally dropped rating_window_ends_at from every RETURNS TABLE clause and
-- from the CTE SELECT in match_graph_row_body / match_graph_row_summary_body.
--
-- Result: after submit_match_result sets rating_window_ends_at = now() + 2h on
-- the DB row, the next get_match_graph_for_user call returns the row without that
-- column → client sees ratingWindowEndsAt = undefined → useRatingWindow treats it
-- as isClosed = true → UI shows "süre doldu" immediately after match ends.
--
-- Fix: drop + recreate all seven functions with rating_window_ends_at restored.
-- No TypeScript changes are needed (MatchRow, mapper, and domain.Match already
-- have the field; the column was simply absent from the RPC return shape).

-- ────────────────────────────────────────────────────────────────────────────
-- Drop in dependency order (dependents first)
-- ────────────────────────────────────────────────────────────────────────────

drop function if exists public.list_match_graphs_for_match_ids(uuid[]);
drop function if exists public.list_visible_match_summaries_for_user(integer, timestamptz, uuid);
drop function if exists public.list_visible_match_graphs_for_user(integer, timestamptz, uuid);
drop function if exists public.get_match_graph_for_user(uuid);
drop function if exists public.match_graph_row(uuid);
drop function if exists public.match_graph_row_body(uuid);
drop function if exists public.match_graph_row_summary_body(uuid);

-- ────────────────────────────────────────────────────────────────────────────
-- match_graph_row_body — full detail (used by get_match_graph_for_user + batch)
-- ────────────────────────────────────────────────────────────────────────────

create function public.match_graph_row_body(p_match_id uuid)
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
  lineup_formation_id text,
  self_report_enabled boolean,
  status public.match_status,
  score_a int,
  score_b int,
  rating_window_ends_at timestamptz,
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
  with m as (
    select
      mt.id,
      mt.starts_at,
      mt.venue,
      mt.organizer_id,
      mt.max_players,
      mt.price_per_person,
      mt.iban,
      mt.join_code,
      mt.lineup_locked,
      mt.lineup_formation_id,
      mt.self_report_enabled,
      mt.status,
      mt.score_a,
      mt.score_b,
      mt.rating_window_ends_at,
      mt.group_id,
      mt.series_id,
      mt.spawned_from_match_id,
      mt.payment_method::text as payment_method,
      mt.iban_account_name,
      mt.payment_note
    from public.matches mt
    where mt.id = p_match_id
  ),
  att as (
    select a.match_id, a.player_id, a.status, a.paid
    from public.match_attendees a
    inner join m on m.id = a.match_id
  ),
  mtp as (
    select t.match_id, t.player_id, t.team, t.slot_index
    from public.match_team_players t
    inner join m on m.id = t.match_id
    order by t.team, t.slot_index nulls last, t.player_id
  ),
  msl as (
    select s.match_id, s.player_id, s.kind, s.count
    from public.match_stat_lines s
    inner join m on m.id = s.match_id and m.status = 'finished'::public.match_status
  ),
  srr as (
    select sr.id, sr.match_id, sr.player_id, sr.type, sr.status
    from public.self_report_requests sr
    inner join m on m.id = sr.match_id
  ),
  profile_ids as (
    select m.organizer_id as player_id from m
    union
    select att.player_id from att
    union
    select mtp.player_id from mtp
    union
    select msl.player_id from msl
    union
    select srr.player_id from srr
  )
  select
    m.id,
    m.starts_at,
    m.venue,
    m.organizer_id,
    m.max_players,
    m.price_per_person,
    m.iban,
    m.iban_account_name,
    m.payment_note,
    m.payment_method,
    m.join_code,
    m.lineup_locked,
    m.lineup_formation_id,
    m.self_report_enabled,
    m.status,
    m.score_a,
    m.score_b,
    m.rating_window_ends_at,
    case
      when m.group_id is not null and public.can_view_group(m.group_id, auth.uid()) then m.group_id
      else null::uuid
    end as group_id,
    case
      when m.series_id is not null then (
        select case
          when public.can_view_group(gws.group_id, auth.uid()) then m.series_id
          else null::uuid
        end
        from public.group_weekly_series gws
        where gws.id = m.series_id
      )
      else null::uuid
    end as series_id,
    case
      when m.spawned_from_match_id is not null
        and public.can_view_match(m.spawned_from_match_id, auth.uid())
      then m.spawned_from_match_id
      else null::uuid
    end as spawned_from_match_id,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'match_id', a.match_id,
          'player_id', a.player_id,
          'status', a.status,
          'paid', a.paid
        )
      )
      from att a
    ), '[]'::jsonb) as attendees,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'match_id', t.match_id,
          'player_id', t.player_id,
          'team', t.team,
          'slot_index', t.slot_index
        )
      )
      from mtp t
    ), '[]'::jsonb) as team_players,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'match_id', s.match_id,
          'player_id', s.player_id,
          'kind', s.kind,
          'count', s.count
        )
      )
      from msl s
    ), '[]'::jsonb) as stat_lines,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', sr.id,
          'match_id', sr.match_id,
          'player_id', sr.player_id,
          'type', sr.type,
          'status', sr.status
        )
      )
      from srr sr
    ), '[]'::jsonb) as self_reports,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'display_name', p.display_name,
          'photo_uri', p.photo_uri,
          'position', p.position,
          'preferred_foot', p.preferred_foot,
          'updated_at', p.updated_at
        )
      )
      from public.profiles_public p
      inner join profile_ids pid on pid.player_id = p.id
    ), '[]'::jsonb) as profiles
  from m;
$$;

revoke execute on function public.match_graph_row_body(uuid) from public;
revoke execute on function public.match_graph_row_body(uuid) from anon;
revoke execute on function public.match_graph_row_body(uuid) from authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- match_graph_row_summary_body — list fast path (no stat_lines/self_reports)
-- ────────────────────────────────────────────────────────────────────────────

create function public.match_graph_row_summary_body(p_match_id uuid)
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
  lineup_formation_id text,
  self_report_enabled boolean,
  status public.match_status,
  score_a int,
  score_b int,
  rating_window_ends_at timestamptz,
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
  with m as (
    select
      mt.id,
      mt.starts_at,
      mt.venue,
      mt.organizer_id,
      mt.max_players,
      mt.price_per_person,
      mt.iban,
      mt.join_code,
      mt.lineup_locked,
      mt.lineup_formation_id,
      mt.self_report_enabled,
      mt.status,
      mt.score_a,
      mt.score_b,
      mt.rating_window_ends_at,
      mt.group_id,
      mt.series_id,
      mt.spawned_from_match_id,
      mt.payment_method::text as payment_method,
      mt.iban_account_name,
      mt.payment_note
    from public.matches mt
    where mt.id = p_match_id
  ),
  att as (
    select a.match_id, a.player_id, a.status, a.paid
    from public.match_attendees a
    inner join m on m.id = a.match_id
  ),
  mtp as (
    select t.match_id, t.player_id, t.team, t.slot_index
    from public.match_team_players t
    inner join m on m.id = t.match_id
    order by t.team, t.slot_index nulls last, t.player_id
  ),
  profile_ids as (
    select m.organizer_id as player_id from m
    union
    select att.player_id from att
    union
    select mtp.player_id from mtp
  )
  select
    m.id,
    m.starts_at,
    m.venue,
    m.organizer_id,
    m.max_players,
    m.price_per_person,
    m.iban,
    m.iban_account_name,
    m.payment_note,
    m.payment_method,
    m.join_code,
    m.lineup_locked,
    m.lineup_formation_id,
    m.self_report_enabled,
    m.status,
    m.score_a,
    m.score_b,
    m.rating_window_ends_at,
    case
      when m.group_id is not null and public.can_view_group(m.group_id, auth.uid()) then m.group_id
      else null::uuid
    end as group_id,
    case
      when m.series_id is not null then (
        select case
          when public.can_view_group(gws.group_id, auth.uid()) then m.series_id
          else null::uuid
        end
        from public.group_weekly_series gws
        where gws.id = m.series_id
      )
      else null::uuid
    end as series_id,
    case
      when m.spawned_from_match_id is not null
        and public.can_view_match(m.spawned_from_match_id, auth.uid())
      then m.spawned_from_match_id
      else null::uuid
    end as spawned_from_match_id,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'match_id', a.match_id,
          'player_id', a.player_id,
          'status', a.status,
          'paid', a.paid
        )
      )
      from att a
    ), '[]'::jsonb) as attendees,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'match_id', t.match_id,
          'player_id', t.player_id,
          'team', t.team,
          'slot_index', t.slot_index
        )
      )
      from mtp t
    ), '[]'::jsonb) as team_players,
    '[]'::jsonb as stat_lines,
    '[]'::jsonb as self_reports,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'display_name', p.display_name,
          'photo_uri', p.photo_uri,
          'position', p.position,
          'preferred_foot', p.preferred_foot,
          'updated_at', p.updated_at
        )
      )
      from public.profiles_public p
      inner join profile_ids pid on pid.player_id = p.id
    ), '[]'::jsonb) as profiles
  from m;
$$;

revoke execute on function public.match_graph_row_summary_body(uuid) from public;
revoke execute on function public.match_graph_row_summary_body(uuid) from anon;
revoke execute on function public.match_graph_row_summary_body(uuid) from authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- match_graph_row — visibility wrapper
-- ────────────────────────────────────────────────────────────────────────────

create function public.match_graph_row(p_match_id uuid)
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
  lineup_formation_id text,
  self_report_enabled boolean,
  status public.match_status,
  score_a int,
  score_b int,
  rating_window_ends_at timestamptz,
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
  select b.*
  from public.match_graph_row_body(p_match_id) b
  where public.can_view_match(p_match_id, auth.uid());
$$;

revoke execute on function public.match_graph_row(uuid) from public;
revoke execute on function public.match_graph_row(uuid) from anon;
revoke execute on function public.match_graph_row(uuid) from authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- get_match_graph_for_user — detail RPC (called by client after score submit)
-- ────────────────────────────────────────────────────────────────────────────

create function public.get_match_graph_for_user(p_match_id uuid)
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
  lineup_formation_id text,
  self_report_enabled boolean,
  status public.match_status,
  score_a int,
  score_b int,
  rating_window_ends_at timestamptz,
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
  select * from public.match_graph_row(p_match_id);
$$;

revoke execute on function public.get_match_graph_for_user(uuid) from public;
revoke execute on function public.get_match_graph_for_user(uuid) from anon;
grant execute on function public.get_match_graph_for_user(uuid) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- list_visible_match_graphs_for_user — match list with cursor pagination
-- ────────────────────────────────────────────────────────────────────────────

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
  lineup_formation_id text,
  self_report_enabled boolean,
  status public.match_status,
  score_a int,
  score_b int,
  rating_window_ends_at timestamptz,
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

-- ────────────────────────────────────────────────────────────────────────────
-- list_visible_match_summaries_for_user — summary list with cursor pagination
-- ────────────────────────────────────────────────────────────────────────────

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
  lineup_formation_id text,
  self_report_enabled boolean,
  status public.match_status,
  score_a int,
  score_b int,
  rating_window_ends_at timestamptz,
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

-- ────────────────────────────────────────────────────────────────────────────
-- list_match_graphs_for_match_ids — batch fetch by id list
-- ────────────────────────────────────────────────────────────────────────────

create function public.list_match_graphs_for_match_ids(p_match_ids uuid[])
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
  lineup_formation_id text,
  self_report_enabled boolean,
  status public.match_status,
  score_a int,
  score_b int,
  rating_window_ends_at timestamptz,
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
  from unnest(coalesce(p_match_ids, array[]::uuid[])) as req(id)
  cross join lateral public.match_graph_row(req.id) as mg;
$$;

revoke execute on function public.list_match_graphs_for_match_ids(uuid[]) from public;
revoke execute on function public.list_match_graphs_for_match_ids(uuid[]) from anon;
grant execute on function public.list_match_graphs_for_match_ids(uuid[]) to authenticated;
