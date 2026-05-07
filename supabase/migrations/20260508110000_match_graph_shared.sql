-- Match graph: shared SQL helper + single-RPC detail fetch
--
-- Adds `public.match_graph_row(uuid)` as the canonical shape used by both
-- the single-match RPC (`public.get_match_graph_for_user`) and the
-- multi-match RPC (`public.list_visible_match_graphs_for_user`). This
-- collapses 6 client round-trips for a single match into 1 by returning the
-- match row plus iç içe (nested) JSONB collections in one payload.

create or replace function public.match_graph_row(p_match_id uuid)
returns table (
  id uuid,
  starts_at timestamptz,
  venue text,
  organizer_id uuid,
  max_players int,
  price_per_person numeric,
  iban text,
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
  select
    m.id,
    m.starts_at,
    m.venue,
    m.organizer_id,
    m.max_players,
    m.price_per_person,
    m.iban,
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
      from public.match_attendees a
      where a.match_id = m.id
    ), '[]'::jsonb) as attendees,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'match_id', t.match_id,
          'player_id', t.player_id,
          'team', t.team
        )
      )
      from public.match_team_players t
      where t.match_id = m.id
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
      from public.match_stat_lines s
      where s.match_id = m.id
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
      from public.self_report_requests sr
      where sr.match_id = m.id
    ), '[]'::jsonb) as self_reports,
    coalesce((
      with profile_ids as (
        select m.organizer_id as player_id
        union
        select a.player_id
        from public.match_attendees a
        where a.match_id = m.id
        union
        select t.player_id
        from public.match_team_players t
        where t.match_id = m.id
        union
        select s.player_id
        from public.match_stat_lines s
        where s.match_id = m.id
        union
        select sr.player_id
        from public.self_report_requests sr
        where sr.match_id = m.id
      )
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
      join profile_ids pid on pid.player_id = p.id
    ), '[]'::jsonb) as profiles
  from public.matches m
  where m.id = p_match_id
    and public.can_view_match(m.id, auth.uid());
$$;

-- Single-match detail RPC. Returns 0 rows when the caller cannot view the
-- match (the visibility check lives inside `match_graph_row`).
create or replace function public.get_match_graph_for_user(p_match_id uuid)
returns table (
  id uuid,
  starts_at timestamptz,
  venue text,
  organizer_id uuid,
  max_players int,
  price_per_person numeric,
  iban text,
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

-- Refactor the multi-match RPC to delegate to the shared helper. The
-- declared return shape is identical to the previous definition to keep the
-- client contract (`MatchGraphRpcRow`) untouched. The outer `where`
-- short-circuits non-visible matches so the helper is not invoked for them,
-- preserving the original query plan characteristics.
create or replace function public.list_visible_match_graphs_for_user()
returns table (
  id uuid,
  starts_at timestamptz,
  venue text,
  organizer_id uuid,
  max_players int,
  price_per_person numeric,
  iban text,
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
  cross join lateral public.match_graph_row(m.id) as mg
  where public.can_view_match(m.id, auth.uid())
  order by mg.starts_at desc, mg.id desc;
$$;

grant execute on function public.get_match_graph_for_user(uuid) to authenticated;
-- `match_graph_row` is an internal helper; not granted to authenticated.
-- It is reachable only via the two security definer RPCs above.
