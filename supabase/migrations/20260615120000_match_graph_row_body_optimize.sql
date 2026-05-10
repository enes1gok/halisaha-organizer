-- Match graph RPCs: internal body without per-row can_view_match (for list/batch after filter),
-- single-pass CTE to avoid duplicate child-table scans, optional list limit.
-- Security: match_graph_row_body is not granted to clients; match_graph_row wraps body + can_view_match.

drop function if exists public.get_match_graph_for_user(uuid);
drop function if exists public.list_visible_match_graphs_for_user();
drop function if exists public.list_match_graphs_for_match_ids(uuid[]);
drop function if exists public.match_graph_row(uuid);

create or replace function public.match_graph_row_body(p_match_id uuid)
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
  created_at timestamptz,
  updated_at timestamptz,
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
    select *
    from public.matches
    where id = p_match_id
  ),
  att as (
    select
      a.match_id,
      a.player_id,
      a.status,
      a.paid
    from public.match_attendees a
    inner join m on m.id = a.match_id
  ),
  mtp as (
    select
      t.match_id,
      t.player_id,
      t.team
    from public.match_team_players t
    inner join m on m.id = t.match_id
  ),
  msl as (
    select
      s.match_id,
      s.player_id,
      s.kind,
      s.count
    from public.match_stat_lines s
    inner join m on m.id = s.match_id
  ),
  srr as (
    select
      sr.id,
      sr.match_id,
      sr.player_id,
      sr.type,
      sr.status,
      sr.created_at
    from public.self_report_requests sr
    inner join m on m.id = sr.match_id
  ),
  profile_ids as (
    select m.organizer_id as player_id
    from m
    union
    select att.player_id
    from att
    union
    select mtp.player_id
    from mtp
    union
    select msl.player_id
    from msl
    union
    select srr.player_id
    from srr
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
    m.self_report_enabled,
    m.status,
    m.score_a,
    m.score_b,
    case
      when m.group_id is not null and public.can_view_group(m.group_id, auth.uid()) then m.group_id
      else null::uuid
    end as group_id,
    m.created_at,
    m.updated_at,
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
          'team', t.team
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
          'status', sr.status,
          'created_at', sr.created_at
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
          'preferred_foot', p.preferred_foot
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

create or replace function public.match_graph_row(p_match_id uuid)
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
  created_at timestamptz,
  updated_at timestamptz,
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

create or replace function public.get_match_graph_for_user(p_match_id uuid)
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
  created_at timestamptz,
  updated_at timestamptz,
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

create or replace function public.list_visible_match_graphs_for_user(p_limit integer default null)
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
  created_at timestamptz,
  updated_at timestamptz,
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
  order by mg.starts_at desc, mg.id desc
  limit p_limit;
$$;

revoke execute on function public.list_visible_match_graphs_for_user(integer) from public;
revoke execute on function public.list_visible_match_graphs_for_user(integer) from anon;
grant execute on function public.list_visible_match_graphs_for_user(integer) to authenticated;

create or replace function public.list_match_graphs_for_match_ids(p_match_ids uuid[])
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
  created_at timestamptz,
  updated_at timestamptz,
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
