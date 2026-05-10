-- Player badge inputs: career totals + goal-match streaks maintained from submit_match_result.
-- Rozet eşikleri istemci kataloğunda; burada yalın sayılar tutulur.

alter table public.player_rating_aggregates
  add column if not exists career_goals integer not null default 0,
  add column if not exists career_assists integer not null default 0,
  add column if not exists finished_matches_played integer not null default 0,
  add column if not exists wins integer not null default 0,
  add column if not exists draws integer not null default 0,
  add column if not exists losses integer not null default 0,
  add column if not exists goal_match_streak_current integer not null default 0,
  add column if not exists goal_match_streak_best integer not null default 0;

comment on column public.player_rating_aggregates.career_goals is
  'Toplam gol (match_stat_lines.kind=goal); skor düzenlemelerinde delta ile güncellenir.';
comment on column public.player_rating_aggregates.goal_match_streak_best is
  'Üst üste gol atılan maç sayısı — yeniden hesaplanmış en iyi seri.';

create index if not exists match_team_players_player_id_idx
  on public.match_team_players (player_id);

-- --- Helpers ---

create or replace function public.match_team_outcome_text(
  p_sa int,
  p_sb int,
  p_team public.team_side
)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select case
    when coalesce(p_sa, 0) = coalesce(p_sb, 0) then 'D'
    when p_team = 'A'::public.team_side then case
      when coalesce(p_sa, 0) > coalesce(p_sb, 0) then 'W'
      else 'L'
    end
    else case
      when coalesce(p_sb, 0) > coalesce(p_sa, 0) then 'W'
      else 'L'
    end
  end;
$$;

revoke all on function public.match_team_outcome_text(int, int, public.team_side) from public;
revoke all on function public.match_team_outcome_text(int, int, public.team_side) from anon;

create or replace function public.refresh_goal_match_streak_for_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cur int := 0;
  v_best int := 0;
  v_g int;
  rec record;
begin
  for rec in
    select m.id as mid
    from public.matches m
    inner join public.match_team_players t
      on t.match_id = m.id and t.player_id = p_player_id
    where m.status = 'finished'::public.match_status
    order by m.starts_at asc
  loop
    select coalesce(sum(s.count), 0)::int into v_g
    from public.match_stat_lines s
    where s.match_id = rec.mid
      and s.player_id = p_player_id
      and s.kind = 'goal'::public.stat_line_kind;

    if v_g >= 1 then
      v_cur := v_cur + 1;
      if v_cur > v_best then
        v_best := v_cur;
      end if;
    else
      v_cur := 0;
    end if;
  end loop;

  insert into public.player_rating_aggregates (
    player_id,
    goal_match_streak_current,
    goal_match_streak_best
  )
  values (p_player_id, v_cur, v_best)
  on conflict (player_id) do update set
    goal_match_streak_current = excluded.goal_match_streak_current,
    goal_match_streak_best = excluded.goal_match_streak_best;
end;
$$;

revoke all on function public.refresh_goal_match_streak_for_player(uuid) from public;
revoke all on function public.refresh_goal_match_streak_for_player(uuid) from anon;

create or replace function public.apply_player_rating_aggregate_deltas_from_submit(
  p_match_id uuid,
  p_old_sa int,
  p_old_sb int,
  p_old_st public.match_status,
  p_new_sa int,
  p_new_sb int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_was_finished boolean := (p_old_st = 'finished'::public.match_status);
  r record;
  v_old_o text;
  v_new_o text;
  v_w_delta int;
  v_d_delta int;
  v_l_delta int;
  v_mp_delta int;
begin
  -- Goals: ilk kez bitişte maçın tamamı eklenir; yeniden gönderimde new − old.
  insert into public.player_rating_aggregates (player_id, career_goals)
  select
    coalesce(n.player_id, o.player_id) as player_id,
    case
      when v_was_finished then coalesce(n.cnt, 0) - coalesce(o.cnt, 0)
      else coalesce(n.cnt, 0)
    end::int as d_goals
  from (
    select player_id, sum(count)::bigint as cnt
    from public.match_stat_lines
    where match_id = p_match_id and kind = 'goal'::public.stat_line_kind
    group by player_id
  ) n
  full outer join (
    select player_id, cnt from _old_match_stats where kind = 'goal'
  ) o on n.player_id = o.player_id
  where case
    when v_was_finished then coalesce(n.cnt, 0) - coalesce(o.cnt, 0)
    else coalesce(n.cnt, 0)
  end <> 0
  on conflict (player_id) do update set
    career_goals = public.player_rating_aggregates.career_goals + excluded.career_goals;

  insert into public.player_rating_aggregates (player_id, career_assists)
  select
    coalesce(n.player_id, o.player_id) as player_id,
    case
      when v_was_finished then coalesce(n.cnt, 0) - coalesce(o.cnt, 0)
      else coalesce(n.cnt, 0)
    end::int as d_ast
  from (
    select player_id, sum(count)::bigint as cnt
    from public.match_stat_lines
    where match_id = p_match_id and kind = 'assist'::public.stat_line_kind
    group by player_id
  ) n
  full outer join (
    select player_id, cnt from _old_match_stats where kind = 'assist'
  ) o on n.player_id = o.player_id
  where case
    when v_was_finished then coalesce(n.cnt, 0) - coalesce(o.cnt, 0)
    else coalesce(n.cnt, 0)
  end <> 0
  on conflict (player_id) do update set
    career_assists = public.player_rating_aggregates.career_assists + excluded.career_assists;

  -- W/D/L + matches played (kadro)
  for r in
    select player_id, team from public.match_team_players where match_id = p_match_id
  loop
    v_old_o := case
      when v_was_finished then public.match_team_outcome_text(p_old_sa, p_old_sb, r.team)
      else null
    end;
    v_new_o := public.match_team_outcome_text(p_new_sa, p_new_sb, r.team);

    v_w_delta :=
      (case when v_new_o = 'W' then 1 else 0 end)
      - (case when v_old_o is not null and v_old_o = 'W' then 1 else 0 end);
    v_d_delta :=
      (case when v_new_o = 'D' then 1 else 0 end)
      - (case when v_old_o is not null and v_old_o = 'D' then 1 else 0 end);
    v_l_delta :=
      (case when v_new_o = 'L' then 1 else 0 end)
      - (case when v_old_o is not null and v_old_o = 'L' then 1 else 0 end);
    v_mp_delta := case when v_was_finished then 0 else 1 end;

    if v_w_delta <> 0 or v_d_delta <> 0 or v_l_delta <> 0 or v_mp_delta <> 0 then
      insert into public.player_rating_aggregates (
        player_id,
        finished_matches_played,
        wins,
        draws,
        losses
      )
      values (r.player_id, v_mp_delta, v_w_delta, v_d_delta, v_l_delta)
      on conflict (player_id) do update set
        finished_matches_played =
          public.player_rating_aggregates.finished_matches_played + excluded.finished_matches_played,
        wins = public.player_rating_aggregates.wins + excluded.wins,
        draws = public.player_rating_aggregates.draws + excluded.draws,
        losses = public.player_rating_aggregates.losses + excluded.losses;
    end if;
  end loop;
end;
$$;

revoke all on function public.apply_player_rating_aggregate_deltas_from_submit(
  uuid, int, int, public.match_status, int, int
) from public;
revoke all on function public.apply_player_rating_aggregate_deltas_from_submit(
  uuid, int, int, public.match_status, int, int
) from anon;

-- --- submit_match_result: capture old stats before delete ---

create or replace function public.submit_match_result(
  p_match_id uuid,
  p_score_a int,
  p_score_b int,
  p_scorers jsonb default '[]'::jsonb,
  p_assists jsonb default '[]'::jsonb,
  p_own_goals jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  starts_ts timestamptz;
  v_old_sa int;
  v_old_sb int;
  v_old_st public.match_status;
  r_player uuid;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;

  if not (
    public.is_match_organizer(p_match_id, uid)
    or public.match_rating_rater_can_participate(p_match_id, uid)
  ) then
    raise exception 'Yetkisiz işlem';
  end if;

  select m.starts_at into starts_ts
  from public.matches m
  where m.id = p_match_id;

  if starts_ts is null then
    perform public.raise_app_error('ERR_MATCH_NOT_FOUND');
  end if;

  if now() < starts_ts + interval '60 minutes' then
    perform public.raise_app_error('ERR_MATCH_SCORE_BEFORE_END');
  end if;

  select m.score_a, m.score_b, m.status
  into v_old_sa, v_old_sb, v_old_st
  from public.matches m
  where m.id = p_match_id;

  drop table if exists _old_match_stats;
  create temp table _old_match_stats (
    player_id uuid not null,
    kind text not null,
    cnt bigint not null,
    primary key (player_id, kind)
  ) on commit drop;

  insert into _old_match_stats (player_id, kind, cnt)
  select
    s.player_id,
    s.kind::text,
    sum(s.count)::bigint
  from public.match_stat_lines s
  where s.match_id = p_match_id
  group by s.player_id, s.kind;

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
    p_match_id,
    (elem ->> 'player_id')::uuid,
    'own_goal'::public.stat_line_kind,
    sum(greatest(1, coalesce((elem ->> 'count')::int, 1)))::int
  from
    jsonb_array_elements(coalesce(p_own_goals, '[]'::jsonb)) elem
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

  perform public.apply_player_rating_aggregate_deltas_from_submit(
    p_match_id,
    v_old_sa,
    v_old_sb,
    v_old_st,
    p_score_a,
    p_score_b
  );

  for r_player in
    select distinct mtp.player_id
    from public.match_team_players mtp
    where mtp.match_id = p_match_id
  loop
    perform public.refresh_goal_match_streak_for_player(r_player);
  end loop;

  perform public.spawn_next_weekly_match(p_match_id);
  perform public.drain_notification_deliveries();
end;
$$;

revoke execute on function public.submit_match_result(uuid, integer, integer, jsonb, jsonb, jsonb) from public;
revoke execute on function public.submit_match_result(uuid, integer, integer, jsonb, jsonb, jsonb) from anon;
grant execute on function public.submit_match_result(uuid, integer, integer, jsonb, jsonb, jsonb) to authenticated;

-- --- RPC: istemci rozet VM için girdi ---

create or replace function public.get_my_player_badge_inputs()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_career_goals int;
  v_career_assists int;
  v_finished_matches_played int;
  v_wins int;
  v_draws int;
  v_losses int;
  v_motm int;
  v_gs_cur int;
  v_gs_best int;
  v_avg numeric;
  v_votes int;
  v_max_g int;
  v_max_a int;
begin
  if v_uid is null then
    perform public.raise_app_error('ERR_AUTH_REQUIRED');
  end if;

  select
    coalesce(pra.career_goals, 0),
    coalesce(pra.career_assists, 0),
    coalesce(pra.finished_matches_played, 0),
    coalesce(pra.wins, 0),
    coalesce(pra.draws, 0),
    coalesce(pra.losses, 0),
    coalesce(pra.motm_count, 0),
    coalesce(pra.goal_match_streak_current, 0),
    coalesce(pra.goal_match_streak_best, 0),
    pra.avg_score_100,
    coalesce(pra.vote_count, 0)
  into
    v_career_goals,
    v_career_assists,
    v_finished_matches_played,
    v_wins,
    v_draws,
    v_losses,
    v_motm,
    v_gs_cur,
    v_gs_best,
    v_avg,
    v_votes
  from (select v_uid as uid) x
  left join public.player_rating_aggregates pra on pra.player_id = x.uid;

  select coalesce(max(x.t), 0)::int into v_max_g
  from (
    select sum(s.count)::int as t
    from public.match_stat_lines s
    where s.player_id = v_uid and s.kind = 'goal'::public.stat_line_kind
    group by s.match_id
  ) x;

  select coalesce(max(x.t), 0)::int into v_max_a
  from (
    select sum(s.count)::int as t
    from public.match_stat_lines s
    where s.player_id = v_uid and s.kind = 'assist'::public.stat_line_kind
    group by s.match_id
  ) x;

  return jsonb_build_object(
    'career_goals', v_career_goals,
    'career_assists', v_career_assists,
    'finished_matches_played', v_finished_matches_played,
    'wins', v_wins,
    'draws', v_draws,
    'losses', v_losses,
    'motm_count', v_motm,
    'goal_match_streak_current', v_gs_cur,
    'goal_match_streak_best', v_gs_best,
    'avg_peer_rating_100', v_avg,
    'peer_rating_vote_count', v_votes,
    'max_goals_single_match', v_max_g,
    'max_assists_single_match', v_max_a
  );
end;
$$;

revoke all on function public.get_my_player_badge_inputs() from public;
revoke all on function public.get_my_player_badge_inputs() from anon;
grant execute on function public.get_my_player_badge_inputs() to authenticated;

comment on function public.get_my_player_badge_inputs() is
  'Oturum açmış kullanıcı için rozet hesaplamasına gerekli özet sayılar (SECURITY DEFINER).';

-- --- Backfill (mevcut veriden) ---

do $$
declare
  r_uid uuid;
begin
  update public.player_rating_aggregates pra
  set career_goals = s.g
  from (
    select player_id, sum(count)::int as g
    from public.match_stat_lines
    where kind = 'goal'::public.stat_line_kind
    group by player_id
  ) s
  where pra.player_id = s.player_id;

  update public.player_rating_aggregates pra
  set career_assists = s.a
  from (
    select player_id, sum(count)::int as a
    from public.match_stat_lines
    where kind = 'assist'::public.stat_line_kind
    group by player_id
  ) s
  where pra.player_id = s.player_id;

  insert into public.player_rating_aggregates (player_id, career_goals, career_assists)
  select
    u.player_id,
    coalesce(g.g, 0),
    coalesce(ast.a, 0)
  from (
    select player_id from (
      select player_id from public.match_stat_lines where kind = 'goal'::public.stat_line_kind
      union
      select player_id from public.match_stat_lines where kind = 'assist'::public.stat_line_kind
    ) x group by player_id
  ) u
  left join (
    select player_id, sum(count)::int as g
    from public.match_stat_lines
    where kind = 'goal'::public.stat_line_kind
    group by player_id
  ) g on g.player_id = u.player_id
  left join (
    select player_id, sum(count)::int as a
    from public.match_stat_lines
    where kind = 'assist'::public.stat_line_kind
    group by player_id
  ) ast on ast.player_id = u.player_id
  where not exists (
    select 1 from public.player_rating_aggregates p where p.player_id = u.player_id
  );

  update public.player_rating_aggregates pra
  set
    finished_matches_played = a.played,
    wins = a.wins,
    draws = a.dr,
    losses = a.ls
  from (
    select
      mtp.player_id,
      count(*)::int as played,
      sum(case when public.match_team_outcome_text(m.score_a, m.score_b, mtp.team) = 'W' then 1 else 0 end)::int as wins,
      sum(case when public.match_team_outcome_text(m.score_a, m.score_b, mtp.team) = 'D' then 1 else 0 end)::int as dr,
      sum(case when public.match_team_outcome_text(m.score_a, m.score_b, mtp.team) = 'L' then 1 else 0 end)::int as ls
    from public.matches m
    inner join public.match_team_players mtp on mtp.match_id = m.id
    where m.status = 'finished'::public.match_status
    group by mtp.player_id
  ) a
  where pra.player_id = a.player_id;

  insert into public.player_rating_aggregates (
    player_id,
    finished_matches_played,
    wins,
    draws,
    losses
  )
  select
    a.player_id,
    a.played,
    a.wins,
    a.dr,
    a.ls
  from (
    select
      mtp.player_id,
      count(*)::int as played,
      sum(case when public.match_team_outcome_text(m.score_a, m.score_b, mtp.team) = 'W' then 1 else 0 end)::int as wins,
      sum(case when public.match_team_outcome_text(m.score_a, m.score_b, mtp.team) = 'D' then 1 else 0 end)::int as dr,
      sum(case when public.match_team_outcome_text(m.score_a, m.score_b, mtp.team) = 'L' then 1 else 0 end)::int as ls
    from public.matches m
    inner join public.match_team_players mtp on mtp.match_id = m.id
    where m.status = 'finished'::public.match_status
    group by mtp.player_id
  ) a
  where not exists (select 1 from public.player_rating_aggregates p where p.player_id = a.player_id)
  on conflict (player_id) do nothing;

  for r_uid in
    select distinct player_id from public.match_team_players
  loop
    perform public.refresh_goal_match_streak_for_player(r_uid);
  end loop;
end;
$$;
