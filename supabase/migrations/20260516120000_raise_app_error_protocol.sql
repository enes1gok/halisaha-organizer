-- Structured Error Protocol: central raise_app_error(); ERR_* tokens via helper; JSON in DETAIL (P0001).

CREATE OR REPLACE FUNCTION public.raise_app_error(
  p_token text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  RAISE EXCEPTION '%', p_token
    USING ERRCODE = 'P0001',
    DETAIL = COALESCE(p_payload::text, '{}');
END;
$fn$;

COMMENT ON FUNCTION public.raise_app_error(text, jsonb) IS
  'Raises stable ERR_* token as message. Optional JSON payload in DETAIL for mapSupabaseError.';

GRANT EXECUTE ON FUNCTION public.raise_app_error(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.raise_app_error(text, jsonb) TO service_role;

-- Replace human-language raise exception text with stable ERR_* tokens for client i18n mapping.
-- Message body is the token only (no translated prose).

-- ---------------------------------------------------------------------------
-- Lineup lock trigger
-- ---------------------------------------------------------------------------

create or replace function public.enforce_lineup_not_locked()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  locked boolean;
  mid uuid := coalesce(new.match_id, old.match_id);
begin
  select m.lineup_locked
  into locked
  from public.matches m
  where m.id = mid;

  if coalesce(locked, false) then
    perform public.raise_app_error('ERR_MATCH_LINEUP_LOCKED');
  end if;

  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------------
-- Leaderboard / visibility
-- ---------------------------------------------------------------------------

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
    perform public.raise_app_error('ERR_GROUP_LEADERBOARD_FORBIDDEN');
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

-- ---------------------------------------------------------------------------
-- Profile bootstrap
-- ---------------------------------------------------------------------------

create or replace function public.ensure_my_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  disp text;
begin
  if uid is null then
    perform public.raise_app_error('ERR_AUTH_REQUIRED');
  end if;

  if exists (select 1 from public.profiles p where p.id = uid) then
    return;
  end if;

  select coalesce(
    nullif(trim(coalesce(
      u.raw_user_meta_data ->> 'full_name',
      u.raw_user_meta_data ->> 'name',
      u.raw_user_meta_data ->> 'display_name',
      split_part(coalesce(u.email, ''), '@', 1),
      ''
    )), ''),
    'Oyuncu'
  )
  into disp
  from auth.users u
  where u.id = uid;

  if disp is null or disp = '' then
    disp := 'Oyuncu';
  end if;

  insert into public.profiles (id, display_name)
  values (uid, disp)
  on conflict (id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Groups
-- ---------------------------------------------------------------------------

create or replace function public.create_group(p_name text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  created public.groups;
  code text;
  trimmed text;
begin
  if uid is null then
    perform public.raise_app_error('ERR_AUTH_REQUIRED');
  end if;

  trimmed := trim(coalesce(p_name, ''));
  if char_length(trimmed) < 2 then
    perform public.raise_app_error('ERR_GROUP_NAME_MIN');
  end if;
  if char_length(trimmed) > 80 then
    perform public.raise_app_error('ERR_GROUP_NAME_MAX');
  end if;

  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.groups (name, owner_id, join_code)
  values (trimmed, uid, code)
  returning * into created;

  insert into public.group_members (group_id, player_id, role)
  values (created.id, uid, 'owner')
  on conflict do nothing;

  return created;
end;
$$;

create or replace function public.join_group_by_code(p_code text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target public.groups;
begin
  if uid is null then
    perform public.raise_app_error('ERR_AUTH_REQUIRED');
  end if;

  select * into target
  from public.groups g
  where upper(regexp_replace(trim(g.join_code), '[\s-]', '', 'g')) =
        upper(regexp_replace(trim(coalesce(p_code, '')), '[\s-]', '', 'g'))
  limit 1;

  if target.id is null then
    return null;
  end if;

  insert into public.group_members (group_id, player_id, role)
  values (target.id, uid, 'member')
  on conflict (group_id, player_id) do nothing;

  return target;
end;
$$;

create or replace function public.join_match_by_join_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  norm text := public.normalize_join_code(p_code);
  mid uuid;
  uid uuid := auth.uid();
begin
  if uid is null then
    perform public.raise_app_error('ERR_AUTH_REQUIRED');
  end if;

  if length(norm) < 2 then
    return null;
  end if;

  select
    m.id into mid
  from
    public.matches m
  where
    m.status = 'upcoming'
    and public.normalize_join_code(m.join_code) = norm
  limit
    1;

  if mid is null then
    return null;
  end if;

  insert into public.match_attendees (match_id, player_id, status, paid)
    values (mid, uid, 'going', false)
  on conflict (match_id, player_id) do update
  set
    status = excluded.status;

  return mid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Peer ratings + MOTM
-- ---------------------------------------------------------------------------

create or replace function public.upsert_match_peer_ratings(p_match_id uuid, p_scores jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  st public.match_status;
  elem jsonb;
  pid uuid;
  sc int;
begin
  if uid is null then
    perform public.raise_app_error('ERR_AUTH_REQUIRED');
  end if;

  if not public.match_rating_rater_can_participate(p_match_id, uid) then
    perform public.raise_app_error('ERR_RATING_CANNOT_PARTICIPATE');
  end if;

  select m.status into st from public.matches m where m.id = p_match_id;
  if st is null then
    perform public.raise_app_error('ERR_MATCH_NOT_FOUND');
  end if;
  if st <> 'finished'::public.match_status then
    perform public.raise_app_error('ERR_RATING_FINISHED_ONLY');
  end if;

  for elem in select * from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb))
  loop
    pid := (elem ->> 'ratee_id')::uuid;
    sc := (elem ->> 'score')::int;
    if pid is null or pid = uid then
      perform public.raise_app_error('ERR_RATING_INVALID_RATEE');
    end if;
    if sc is null or sc < 1 or sc > 10 then
      perform public.raise_app_error('ERR_RATING_SCORE_RANGE');
    end if;
    if not public.match_rating_ratee_is_eligible(p_match_id, pid) then
      perform public.raise_app_error('ERR_RATING_RATEE_INELIGIBLE');
    end if;
  end loop;

  delete from public.match_peer_ratings r
  where r.match_id = p_match_id and r.rater_id = uid;

  for elem in select * from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb))
  loop
    pid := (elem ->> 'ratee_id')::uuid;
    sc := (elem ->> 'score')::int;
    insert into public.match_peer_ratings (match_id, rater_id, ratee_id, score)
    values (p_match_id, uid, pid, sc::smallint);
  end loop;
end;
$$;

create or replace function public.upsert_match_motm_vote(p_match_id uuid, p_pick_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  st public.match_status;
begin
  if uid is null then
    perform public.raise_app_error('ERR_AUTH_REQUIRED');
  end if;

  if not public.match_rating_rater_can_participate(p_match_id, uid) then
    perform public.raise_app_error('ERR_MOTM_CANNOT_VOTE');
  end if;

  if p_pick_player_id is null or p_pick_player_id = uid then
    perform public.raise_app_error('ERR_MOTM_INVALID_PICK');
  end if;

  select m.status into st from public.matches m where m.id = p_match_id;
  if st is null then
    perform public.raise_app_error('ERR_MATCH_NOT_FOUND');
  end if;
  if st <> 'finished'::public.match_status then
    perform public.raise_app_error('ERR_MOTM_FINISHED_ONLY');
  end if;

  if not public.match_rating_ratee_is_eligible(p_match_id, p_pick_player_id) then
    perform public.raise_app_error('ERR_MOTM_PLAYER_NOT_ON_FIELD');
  end if;

  insert into public.match_motm_votes (match_id, voter_id, pick_player_id)
  values (p_match_id, uid, p_pick_player_id)
  on conflict (match_id, voter_id) do update
  set pick_player_id = excluded.pick_player_id,
      created_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Submit match result (latest: spawn weekly + lineup raters)
-- ---------------------------------------------------------------------------

create or replace function public.submit_match_result(
  p_match_id uuid,
  p_score_a int,
  p_score_b int,
  p_scorers jsonb default '[]'::jsonb,
  p_assists jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    perform public.raise_app_error('ERR_AUTH_REQUIRED');
  end if;

  if not (
    public.is_match_organizer(p_match_id, uid)
    or public.match_rating_rater_can_participate(p_match_id, uid)
  ) then
    perform public.raise_app_error('ERR_FORBIDDEN');
  end if;

  delete from public.match_stat_lines
  where
    match_id = p_match_id;

  insert into public.match_stat_lines (match_id, player_id, kind, count)
  select
    p_match_id,
    (elem ->> 'player_id')::uuid,
    'goal'::public.stat_line_kind,
    sum(greatest(1, coalesce((elem ->> 'count')::int, 1)))::int
  from
    jsonb_array_elements(coalesce(p_scorers, '[]'::jsonb)) elem
  group by
    p_match_id,
    (elem ->> 'player_id')::uuid;

  insert into public.match_stat_lines (match_id, player_id, kind, count)
  select
    p_match_id,
    (elem ->> 'player_id')::uuid,
    'assist'::public.stat_line_kind,
    sum(greatest(1, coalesce((elem ->> 'count')::int, 1)))::int
  from
    jsonb_array_elements(coalesce(p_assists, '[]'::jsonb)) elem
  group by
    p_match_id,
    (elem ->> 'player_id')::uuid;

  insert into public.match_stat_lines (match_id, player_id, kind, count)
  select
    sr.match_id,
    sr.player_id,
    case
      when sr.type = 'goal'::public.self_report_type then 'goal'::public.stat_line_kind
      else 'assist'::public.stat_line_kind
    end,
    count(*)::int
  from
    public.self_report_requests sr
  where
    sr.match_id = p_match_id
    and sr.status = 'approved'
  group by
    sr.match_id,
    sr.player_id,
    sr.type
  on conflict (match_id, player_id, kind) do update
  set
    count = public.match_stat_lines.count + excluded.count;

  update
    public.matches
  set
    score_a = p_score_a,
    score_b = p_score_b,
    status = 'finished'::public.match_status,
    updated_at = now()
  where
    id = p_match_id;

  perform public.spawn_next_weekly_match(p_match_id);
end;
$$;
