-- Lineup slot positions + formation id persistence.
--
-- Bug #1: When the organizer published a tactical-board lineup (14/16/22 max_players),
-- the slot positions were lost because match_team_players had no slot_index column
-- and the row order was not preserved by Postgres. After publish, other devices saw
-- players placed in wrong slots.
--
-- Bug #2: lineup_formation_id was a local-only field, so other devices did not even
-- know which formation template was used. Non-organizers also could not view the
-- lineup because the LineupBuilder screen blocked them.
--
-- Fix: persist slot_index on match_team_players + match_guest_team_assignments,
-- persist lineup_formation_id on matches, and add set_match_teams_v3 RPC that
-- accepts slot positions + formation id atomically. The match-graph RPCs
-- (get_match_graph_for_user, list_visible_match_*) are updated to return
-- slot_index inside the team_players JSON and lineup_formation_id as a new
-- top-level column so realtime/hydration carries position info to all clients.

-- ────────────────────────────────────────────────────────────────────────────
-- Schema columns
-- ────────────────────────────────────────────────────────────────────────────

alter table public.matches
  add column if not exists lineup_formation_id text;

alter table public.match_team_players
  add column if not exists slot_index int;

alter table public.match_guest_team_assignments
  add column if not exists slot_index int;

-- One slot per (match, team) when slot_index is set; null slot_index means
-- classic mode (no formation) and is allowed to repeat.
create unique index if not exists match_team_players_match_team_slot_unique
  on public.match_team_players (match_id, team, slot_index)
  where slot_index is not null;

create unique index if not exists match_guest_team_assignments_match_team_slot_unique
  on public.match_guest_team_assignments (match_id, team, slot_index)
  where slot_index is not null;

-- ────────────────────────────────────────────────────────────────────────────
-- RPC: set_match_teams_v3
-- Atomically replaces registered + guest team assignments AND updates the
-- match's lineup_formation_id. Slot indices are positional alongside the
-- player id arrays (i.e. slot_idx[i] is the slot for player_ids[i]).
-- A null slot_index array (or shorter array) means "no slot info" and falls
-- back to classic-list ordering.
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.set_match_teams_v3(
  p_match_id              uuid,
  p_team_a_player_ids     uuid[],
  p_team_b_player_ids     uuid[],
  p_team_a_slot_idx       int[]   default null,
  p_team_b_slot_idx       int[]   default null,
  p_team_a_guest_ids      uuid[]  default array[]::uuid[],
  p_team_b_guest_ids      uuid[]  default array[]::uuid[],
  p_team_a_guest_slot_idx int[]   default null,
  p_team_b_guest_slot_idx int[]   default null,
  p_lineup_formation_id   text    default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    perform public.raise_app_error('ERR_AUTH_REQUIRED');
  end if;

  if not public.can_manage_group_match(p_match_id, uid) then
    perform public.raise_app_error('ERR_NOT_AUTHORIZED');
  end if;

  -- Validate slot-array lengths match player-array lengths when provided.
  if p_team_a_slot_idx is not null
     and array_length(p_team_a_slot_idx, 1) is distinct from array_length(p_team_a_player_ids, 1) then
    perform public.raise_app_error('ERR_LINEUP_SLOT_LENGTH_MISMATCH');
  end if;
  if p_team_b_slot_idx is not null
     and array_length(p_team_b_slot_idx, 1) is distinct from array_length(p_team_b_player_ids, 1) then
    perform public.raise_app_error('ERR_LINEUP_SLOT_LENGTH_MISMATCH');
  end if;
  if p_team_a_guest_slot_idx is not null
     and array_length(p_team_a_guest_slot_idx, 1) is distinct from array_length(p_team_a_guest_ids, 1) then
    perform public.raise_app_error('ERR_LINEUP_SLOT_LENGTH_MISMATCH');
  end if;
  if p_team_b_guest_slot_idx is not null
     and array_length(p_team_b_guest_slot_idx, 1) is distinct from array_length(p_team_b_guest_ids, 1) then
    perform public.raise_app_error('ERR_LINEUP_SLOT_LENGTH_MISMATCH');
  end if;

  -- Registered team players
  delete from public.match_team_players where match_id = p_match_id;

  insert into public.match_team_players (match_id, player_id, team, slot_index)
  select p_match_id, t.pid, 'A'::public.team_side, s.idx
  from unnest(p_team_a_player_ids) with ordinality as t(pid, ord)
  left join unnest(coalesce(p_team_a_slot_idx, array[]::int[])) with ordinality as s(idx, ord)
    on t.ord = s.ord;

  insert into public.match_team_players (match_id, player_id, team, slot_index)
  select p_match_id, t.pid, 'B'::public.team_side, s.idx
  from unnest(p_team_b_player_ids) with ordinality as t(pid, ord)
  left join unnest(coalesce(p_team_b_slot_idx, array[]::int[])) with ordinality as s(idx, ord)
    on t.ord = s.ord;

  -- Guest team assignments
  delete from public.match_guest_team_assignments where match_id = p_match_id;

  insert into public.match_guest_team_assignments (match_id, guest_id, team, slot_index)
  select p_match_id, t.gid, 'A'::public.team_side, s.idx
  from unnest(p_team_a_guest_ids) with ordinality as t(gid, ord)
  left join unnest(coalesce(p_team_a_guest_slot_idx, array[]::int[])) with ordinality as s(idx, ord)
    on t.ord = s.ord;

  insert into public.match_guest_team_assignments (match_id, guest_id, team, slot_index)
  select p_match_id, t.gid, 'B'::public.team_side, s.idx
  from unnest(p_team_b_guest_ids) with ordinality as t(gid, ord)
  left join unnest(coalesce(p_team_b_guest_slot_idx, array[]::int[])) with ordinality as s(idx, ord)
    on t.ord = s.ord;

  -- Formation id: pass null to clear, non-null to set.
  update public.matches
  set lineup_formation_id = p_lineup_formation_id,
      updated_at = now()
  where id = p_match_id;
end;
$$;

revoke execute on function public.set_match_teams_v3(
  uuid, uuid[], uuid[], int[], int[], uuid[], uuid[], int[], int[], text
) from public, anon;
grant execute on function public.set_match_teams_v3(
  uuid, uuid[], uuid[], int[], int[], uuid[], uuid[], int[], int[], text
) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- Match graph RPC evolution (return shape adds lineup_formation_id;
-- team_players JSON gains slot_index per element).
--
-- Per supabase-schema-evolution.md: changing the RETURNS TABLE shape requires
-- DROP + recreate in dependency order. Drop dependents first.
-- ────────────────────────────────────────────────────────────────────────────

drop function if exists public.list_match_graphs_for_match_ids(uuid[]);
drop function if exists public.list_visible_match_summaries_for_user(integer);
drop function if exists public.list_visible_match_summaries_for_user(integer, timestamptz, uuid);
drop function if exists public.list_visible_match_graphs_for_user(integer);
drop function if exists public.list_visible_match_graphs_for_user(integer, timestamptz, uuid);
drop function if exists public.get_match_graph_for_user(uuid);
drop function if exists public.match_graph_row(uuid);
drop function if exists public.match_graph_row_body(uuid);
drop function if exists public.match_graph_row_summary_body(uuid);

-- Full graph body (detail + batch list fallback)
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

-- Summary body (list hydrate fast path)
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

-- Visibility wrapper
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

-- Detail RPC
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

-- Match-list RPC with cursor pagination
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

-- Summary-list RPC with cursor pagination
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

-- Batch fetch by ids
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
