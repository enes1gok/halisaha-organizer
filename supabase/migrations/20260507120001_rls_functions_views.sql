-- RLS, RPCs, leaderboard stats (aligned with src/utils/stats.ts + leaderboard.ts)

-- --- Helpers (SECURITY DEFINER bypasses RLS for existence checks) ---

create or replace function public.is_match_organizer(p_match_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select
      1
    from
      public.matches m
    where
      m.id = p_match_id
      and m.organizer_id = p_uid
  );
$$;

create or replace function public.can_view_match(p_match_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select
      1
    from
      public.matches m
    where
      m.id = p_match_id
      and (
        m.organizer_id = p_uid
        or exists (
          select
            1
          from
            public.match_attendees a
          where
            a.match_id = m.id
            and a.player_id = p_uid
        )
        or exists (
          select
            1
          from
            public.match_team_players t
          where
            t.match_id = m.id
            and t.player_id = p_uid
        )
      )
  );
$$;

-- Join code normalization (matches client: strip spaces/dashes, uppercase)

create or replace function public.normalize_join_code(p_code text)
returns text
language sql
immutable
as $$
  select
    upper(regexp_replace(trim(coalesce(p_code, '')), '[\s-]', '', 'g'));
$$;

create index if not exists matches_join_code_normalized_idx on public.matches (public.normalize_join_code(join_code));

-- --- RPC: preview upcoming match by code (anon + authenticated) ---

create or replace function public.get_match_by_join_code(p_code text)
returns table (
  id uuid,
  starts_at timestamptz,
  venue text,
  max_players int,
  join_code text,
  status public.match_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  norm text := public.normalize_join_code(p_code);
begin
  if length(norm) < 2 then
    return;
  end if;

  return query
  select
    m.id,
    m.starts_at,
    m.venue,
    m.max_players,
    m.join_code,
    m.status
  from
    public.matches m
  where
    m.status = 'upcoming'
    and public.normalize_join_code(m.join_code) = norm
  limit
    1;
end;
$$;

-- --- RPC: join as current user (SECURITY DEFINER; validates upcoming + code) ---

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
    raise exception 'Oturum gerekli';
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

-- --- RPC: atomically persist score + stat lines + merge approved self-reports (submitScore) ---

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
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not public.is_match_organizer(p_match_id, uid) then
    raise exception 'Yetkisiz işlem';
  end if;

  delete from public.match_stat_lines
  where match_id = p_match_id;

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
end;
$$;

-- --- Leaderboard / stats RPC (timeframe: all | week | month; ref = app "now") ---

create or replace function public.player_leaderboard_stats(
  p_timeframe text default 'all',
  p_ref timestamptz default now()
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
language sql
stable
security definer
set search_path = public
as $$
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
    select
      m.*
    from
      public.matches m
      cross join bounds b
    where
      m.status = 'finished'
      and m.score_a is not null
      and m.score_b is not null
      and (
        p_timeframe = 'all'
        or (
          m.starts_at >= b.start_ts
          and m.starts_at < b.end_ts
        )
      )
  ),
  roster as (
    select
      f.id as match_id,
      f.score_a,
      f.score_b,
      t.player_id,
      t.team
    from
      finished f
      join public.match_team_players t on t.match_id = f.id
  ),
  outcomes as (
    select
      r.match_id,
      r.player_id,
      case
        when r.score_a = r.score_b then 'D'::text
        when r.team = 'A'
        and r.score_a > r.score_b then 'W'
        when r.team = 'A'
        and r.score_a < r.score_b then 'L'
        when r.team = 'B'
        and r.score_b > r.score_a then 'W'
        when r.team = 'B'
        and r.score_b < r.score_a then 'L'
        else 'D'
      end as outcome
    from
      roster r
  ),
  agg_outcomes as (
    select
      o.player_id,
      count(*) filter (
        where
          o.outcome = 'W'
      ) as wins,
      count(*) filter (
        where
          o.outcome = 'L'
      ) as losses,
      count(*) filter (
        where
          o.outcome = 'D'
      ) as draws,
      count(*)::bigint as matches_played
    from
      outcomes o
    group by
      o.player_id
  ),
  goal_agg as (
    select
      sl.player_id,
      sum(sl.count)::bigint as goals
    from
      public.match_stat_lines sl
      join finished f on f.id = sl.match_id
    where
      sl.kind = 'goal'
    group by
      sl.player_id
  ),
  assist_agg as (
    select
      sl.player_id,
      sum(sl.count)::bigint as assists
    from
      public.match_stat_lines sl
      join finished f on f.id = sl.match_id
    where
      sl.kind = 'assist'
    group by
      sl.player_id
  )
  select
    p.id as player_id,
    coalesce(g.goals, 0::bigint) as goals,
    coalesce(a.assists, 0::bigint) as assists,
    coalesce(o.matches_played, 0::bigint) as matches_played,
    coalesce(o.wins, 0::bigint) as wins,
    coalesce(o.losses, 0::bigint) as losses,
    coalesce(o.draws, 0::bigint) as draws
  from
    public.profiles p
    left join agg_outcomes o on o.player_id = p.id
    left join goal_agg g on g.player_id = p.id
    left join assist_agg a on a.player_id = p.id
  where
    coalesce(o.matches_played, 0) > 0
    or coalesce(g.goals, 0) > 0
    or coalesce(a.assists, 0) > 0;
$$;

comment on function public.player_leaderboard_stats (text, timestamptz) is
  'Aggregates finished matches; timeframe week/month uses Postgres date_trunc (ISO week, Monday).';

-- --- RLS ---

alter table public.profiles enable row level security;

alter table public.matches enable row level security;

alter table public.match_attendees enable row level security;

alter table public.match_team_players enable row level security;

alter table public.match_stat_lines enable row level security;

alter table public.self_report_requests enable row level security;

-- profiles

drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles for select to authenticated using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated using (id = auth.uid())
with
  check (id = auth.uid());

-- matches

drop policy if exists matches_select_visible on public.matches;
create policy matches_select_visible on public.matches for
select
  to authenticated using (public.can_view_match (id, auth.uid()));

drop policy if exists matches_insert_organizer on public.matches;
create policy matches_insert_organizer on public.matches for insert to authenticated with check (organizer_id = auth.uid());

drop policy if exists matches_update_organizer on public.matches;
create policy matches_update_organizer on public.matches for
update to authenticated using (public.is_match_organizer (id, auth.uid()))
with
  check (public.is_match_organizer (id, auth.uid()));

drop policy if exists matches_delete_organizer on public.matches;
create policy matches_delete_organizer on public.matches for delete to authenticated using (public.is_match_organizer (id, auth.uid()));

-- match_attendees

drop policy if exists match_attendees_select_visible on public.match_attendees;
create policy match_attendees_select_visible on public.match_attendees for
select
  to authenticated using (public.can_view_match (match_id, auth.uid()));

drop policy if exists match_attendees_insert_organizer on public.match_attendees;
create policy match_attendees_insert_organizer on public.match_attendees for insert to authenticated with check (public.is_match_organizer (match_id, auth.uid()));

drop policy if exists match_attendees_update_player on public.match_attendees;
create policy match_attendees_update_player on public.match_attendees for
update to authenticated using (
  player_id = auth.uid ()
)
with
  check (player_id = auth.uid ());

drop policy if exists match_attendees_update_organizer on public.match_attendees;
create policy match_attendees_update_organizer on public.match_attendees for
update to authenticated using (public.is_match_organizer (match_id, auth.uid()))
with
  check (public.is_match_organizer (match_id, auth.uid()));

drop policy if exists match_attendees_delete_organizer on public.match_attendees;
create policy match_attendees_delete_organizer on public.match_attendees for delete to authenticated using (public.is_match_organizer (match_id, auth.uid()));

-- match_team_players

drop policy if exists match_team_players_select_visible on public.match_team_players;
create policy match_team_players_select_visible on public.match_team_players for
select
  to authenticated using (public.can_view_match (match_id, auth.uid()));

drop policy if exists match_team_players_write_organizer on public.match_team_players;
create policy match_team_players_write_organizer on public.match_team_players for all to authenticated using (public.is_match_organizer (match_id, auth.uid()))
with
  check (public.is_match_organizer (match_id, auth.uid()));

-- match_stat_lines

drop policy if exists match_stat_lines_select_visible on public.match_stat_lines;
create policy match_stat_lines_select_visible on public.match_stat_lines for
select
  to authenticated using (public.can_view_match (match_id, auth.uid()));

drop policy if exists match_stat_lines_write_organizer on public.match_stat_lines;
create policy match_stat_lines_write_organizer on public.match_stat_lines for all to authenticated using (public.is_match_organizer (match_id, auth.uid()))
with
  check (public.is_match_organizer (match_id, auth.uid()));

-- self_report_requests

drop policy if exists self_reports_select on public.self_report_requests;
create policy self_reports_select on public.self_report_requests for
select
  to authenticated using (
    player_id = auth.uid ()
    or public.is_match_organizer (match_id, auth.uid ())
  );

drop policy if exists self_reports_insert_player on public.self_report_requests;
create policy self_reports_insert_player on public.self_report_requests for insert to authenticated with check (
  player_id = auth.uid ()
  and exists (
    select
      1
    from
      public.matches m
    where
      m.id = match_id
      and m.self_report_enabled = true
      and public.can_view_match (m.id, auth.uid ())
  )
);

drop policy if exists self_reports_update_organizer on public.self_report_requests;
create policy self_reports_update_organizer on public.self_report_requests for
update to authenticated using (public.is_match_organizer (match_id, auth.uid()))
with
  check (public.is_match_organizer (match_id, auth.uid()));

drop policy if exists self_reports_delete_organizer on public.self_report_requests;
create policy self_reports_delete_organizer on public.self_report_requests for delete to authenticated using (public.is_match_organizer (match_id, auth.uid()));

-- --- Grants (Supabase API) ---

grant usage on schema public to anon, authenticated, service_role;

grant select on table public.profiles to authenticated;

grant
update on table public.profiles to authenticated;

grant select,
insert,
update,
delete on table public.matches to authenticated;

grant select,
insert,
update,
delete on table public.match_attendees to authenticated;

grant select,
insert,
update,
delete on table public.match_team_players to authenticated;

grant select,
insert,
update,
delete on table public.match_stat_lines to authenticated;

grant select,
insert,
update,
delete on table public.self_report_requests to authenticated;

grant all on all tables in schema public to service_role;

grant execute on function public.normalize_join_code (text) to anon, authenticated;

grant execute on function public.get_match_by_join_code (text) to anon, authenticated;

grant execute on function public.join_match_by_join_code (text) to authenticated;

grant execute on function public.submit_match_result (uuid, int, int, jsonb, jsonb) to authenticated;

grant execute on function public.player_leaderboard_stats (text, timestamptz) to authenticated;

grant execute on function public.is_match_organizer (uuid, uuid) to authenticated;

grant execute on function public.can_view_match (uuid, uuid) to authenticated;
