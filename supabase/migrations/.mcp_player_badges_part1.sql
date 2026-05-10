drop function if exists public.submit_match_result(uuid, integer, integer, jsonb, jsonb);

do $$
begin
  alter type public.stat_line_kind add value 'own_goal';
exception
  when duplicate_object then
    null;
end $$;

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
