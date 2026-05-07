-- Visibility split (match vs group) + group-scoped leaderboard filters

create or replace function public.get_match_detail_for_user(p_match_id uuid)
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
  updated_at timestamptz
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
    m.updated_at
  from public.matches m
  where m.id = p_match_id
    and public.can_view_match(m.id, auth.uid());
$$;

create or replace function public.list_visible_matches_for_user()
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
  updated_at timestamptz
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
    m.updated_at
  from public.matches m
  where public.can_view_match(m.id, auth.uid());
$$;

create or replace view public.profiles_public
with (security_invoker = true) as
select
  p.id,
  p.display_name,
  p.photo_uri,
  p.position,
  p.preferred_foot
from public.profiles p;

grant select on table public.profiles_public to authenticated;

create or replace function public.player_leaderboard_stats(
  p_timeframe text default 'all',
  p_ref timestamptz default now(),
  p_group_id uuid default null,
  p_metric text default null
)
returns table (
  player_id uuid,
  goals bigint,
  assists bigint,
  matches_played bigint,
  wins bigint,
  losses bigint,
  draws bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_group_id is not null and not public.can_view_group(p_group_id, auth.uid()) then
    raise exception 'Bu grubun istatistiklerini gorme yetkiniz yok.';
  end if;

  return query
  with bounds as (
    select
      case
        when p_timeframe = 'week' then date_trunc('week', p_ref)
        when p_timeframe = 'month' then date_trunc('month', p_ref)
        else null::timestamptz
      end as start_ts,
      case
        when p_timeframe = 'week' then date_trunc('week', p_ref) + interval '7 days'
        when p_timeframe = 'month' then date_trunc('month', p_ref) + interval '1 month'
        else null::timestamptz
      end as end_ts
  ),
  finished as (
    select m.*
    from public.matches m
    cross join bounds b
    where m.status = 'finished'
      and m.score_a is not null
      and m.score_b is not null
      and (p_group_id is null or m.group_id = p_group_id)
      and (
        p_timeframe = 'all'
        or (m.starts_at >= b.start_ts and m.starts_at < b.end_ts)
      )
  ),
  roster as (
    select
      f.id as match_id,
      f.score_a,
      f.score_b,
      t.player_id,
      t.team
    from finished f
    join public.match_team_players t on t.match_id = f.id
  ),
  outcomes as (
    select
      r.match_id,
      r.player_id,
      case
        when r.score_a = r.score_b then 'D'::text
        when r.team = 'A' and r.score_a > r.score_b then 'W'
        when r.team = 'A' and r.score_a < r.score_b then 'L'
        when r.team = 'B' and r.score_b > r.score_a then 'W'
        when r.team = 'B' and r.score_b < r.score_a then 'L'
        else 'D'
      end as outcome
    from roster r
  ),
  agg_outcomes as (
    select
      o.player_id,
      count(*) filter (where o.outcome = 'W') as wins,
      count(*) filter (where o.outcome = 'L') as losses,
      count(*) filter (where o.outcome = 'D') as draws,
      count(*)::bigint as matches_played
    from outcomes o
    group by o.player_id
  ),
  goal_agg as (
    select
      sl.player_id,
      sum(sl.count)::bigint as goals
    from public.match_stat_lines sl
    join finished f on f.id = sl.match_id
    where sl.kind = 'goal'
    group by sl.player_id
  ),
  assist_agg as (
    select
      sl.player_id,
      sum(sl.count)::bigint as assists
    from public.match_stat_lines sl
    join finished f on f.id = sl.match_id
    where sl.kind = 'assist'
    group by sl.player_id
  )
  select
    o.player_id,
    coalesce(g.goals, 0::bigint) as goals,
    coalesce(a.assists, 0::bigint) as assists,
    coalesce(o.matches_played, 0::bigint) as matches_played,
    coalesce(o.wins, 0::bigint) as wins,
    coalesce(o.losses, 0::bigint) as losses,
    coalesce(o.draws, 0::bigint) as draws
  from agg_outcomes o
  left join goal_agg g on g.player_id = o.player_id
  left join assist_agg a on a.player_id = o.player_id
  where
    (
      p_metric = 'goals' and coalesce(g.goals, 0) > 0
    )
    or (
      p_metric = 'assists' and coalesce(a.assists, 0) > 0
    )
    or (
      p_metric is null and (
        coalesce(o.matches_played, 0) > 0
        or coalesce(g.goals, 0) > 0
        or coalesce(a.assists, 0) > 0
      )
    )
    or (
      p_metric not in ('goals', 'assists') and coalesce(o.matches_played, 0) > 0
    );
end;
$$;

grant execute on function public.get_match_detail_for_user(uuid) to authenticated;
grant execute on function public.list_visible_matches_for_user() to authenticated;
grant execute on function public.player_leaderboard_stats(text, timestamptz, uuid, text) to authenticated;
