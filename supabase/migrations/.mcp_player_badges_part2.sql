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
