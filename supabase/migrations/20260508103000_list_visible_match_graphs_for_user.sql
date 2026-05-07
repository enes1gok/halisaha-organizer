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
  with visible_matches as (
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
      m.updated_at
    from public.matches m
    where public.can_view_match(m.id, auth.uid())
  )
  select
    vm.id,
    vm.starts_at,
    vm.venue,
    vm.organizer_id,
    vm.max_players,
    vm.price_per_person,
    vm.iban,
    vm.join_code,
    vm.lineup_locked,
    vm.self_report_enabled,
    vm.status,
    vm.score_a,
    vm.score_b,
    vm.group_id,
    vm.created_at,
    vm.updated_at,
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
      where a.match_id = vm.id
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
      where t.match_id = vm.id
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
      where s.match_id = vm.id
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
      where sr.match_id = vm.id
    ), '[]'::jsonb) as self_reports,
    coalesce((
      with profile_ids as (
        select vm.organizer_id as player_id
        union
        select a.player_id
        from public.match_attendees a
        where a.match_id = vm.id
        union
        select t.player_id
        from public.match_team_players t
        where t.match_id = vm.id
        union
        select s.player_id
        from public.match_stat_lines s
        where s.match_id = vm.id
        union
        select sr.player_id
        from public.self_report_requests sr
        where sr.match_id = vm.id
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
  from visible_matches vm
  order by vm.starts_at desc, vm.id desc;
$$;

grant execute on function public.list_visible_match_graphs_for_user() to authenticated;
