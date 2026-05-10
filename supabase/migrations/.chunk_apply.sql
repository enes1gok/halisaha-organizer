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
