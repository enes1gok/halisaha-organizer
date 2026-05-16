-- Migration: Organizer can edit match score and stat lines after match is finished.
--
-- New RPC: update_match_result_organizer
--   - Requires can_manage_group_match (organizer or group admin)
--   - Match must already be finished
--   - Does NOT reset rating_window_ends_at (rating period unaffected)
--   - Does NOT call spawn_next_weekly_match or drain_notification_deliveries
--   - Updates score, stat lines, player aggregates, and goal streaks
--
-- New ERR token: ERR_MATCH_NOT_FINISHED

create or replace function public.update_match_result_organizer(
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
  v_old_sa int;
  v_old_sb int;
  v_old_st public.match_status;
  r_player uuid;
begin
  if uid is null then
    perform public.raise_app_error('ERR_AUTH_REQUIRED');
  end if;

  if not public.can_manage_group_match(p_match_id, uid) then
    perform public.raise_app_error('ERR_NOT_AUTHORIZED');
  end if;

  select m.score_a, m.score_b, m.status
  into v_old_sa, v_old_sb, v_old_st
  from public.matches m
  where m.id = p_match_id;

  if v_old_st is null then
    perform public.raise_app_error('ERR_MATCH_NOT_FOUND');
  end if;

  if v_old_st <> 'finished'::public.match_status then
    perform public.raise_app_error('ERR_MATCH_NOT_FINISHED');
  end if;

  drop table if exists _old_match_stats;
  create temp table _old_match_stats (
    player_id uuid not null,
    kind text not null,
    cnt bigint not null,
    primary key (player_id, kind)
  ) on commit drop;

  insert into _old_match_stats (player_id, kind, cnt)
  select s.player_id, s.kind::text, sum(s.count)::bigint
  from public.match_stat_lines s
  where s.match_id = p_match_id
  group by s.player_id, s.kind;

  delete from public.match_stat_lines
  where match_id = p_match_id;

  insert into public.match_stat_lines (match_id, player_id, kind, count)
  select
    p_match_id,
    (elem->>'player_id')::uuid,
    'goal'::public.stat_line_kind,
    sum(greatest(1, coalesce((elem->>'count')::int, 1)))::int
  from jsonb_array_elements(coalesce(p_scorers, '[]'::jsonb)) elem
  group by p_match_id, (elem->>'player_id')::uuid;

  insert into public.match_stat_lines (match_id, player_id, kind, count)
  select
    p_match_id,
    (elem->>'player_id')::uuid,
    'assist'::public.stat_line_kind,
    sum(greatest(1, coalesce((elem->>'count')::int, 1)))::int
  from jsonb_array_elements(coalesce(p_assists, '[]'::jsonb)) elem
  group by p_match_id, (elem->>'player_id')::uuid;

  insert into public.match_stat_lines (match_id, player_id, kind, count)
  select
    p_match_id,
    (elem->>'player_id')::uuid,
    'own_goal'::public.stat_line_kind,
    sum(greatest(1, coalesce((elem->>'count')::int, 1)))::int
  from jsonb_array_elements(coalesce(p_own_goals, '[]'::jsonb)) elem
  group by p_match_id, (elem->>'player_id')::uuid;

  -- Re-apply approved self-reports on top of organizer entries
  insert into public.match_stat_lines (match_id, player_id, kind, count)
  select
    sr.match_id,
    sr.player_id,
    case
      when sr.type = 'goal'::public.self_report_type then 'goal'::public.stat_line_kind
      else 'assist'::public.stat_line_kind
    end,
    count(*)::int
  from public.self_report_requests sr
  where sr.match_id = p_match_id
    and sr.status = 'approved'
  group by sr.match_id, sr.player_id, sr.type
  on conflict (match_id, player_id, kind) do update
    set count = public.match_stat_lines.count + excluded.count;

  -- Update score only; rating_window_ends_at is intentionally left unchanged
  update public.matches
  set
    score_a = p_score_a,
    score_b = p_score_b,
    updated_at = now()
  where id = p_match_id;

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
end;
$$;

revoke execute on function public.update_match_result_organizer(uuid, integer, integer, jsonb, jsonb, jsonb) from public;
revoke execute on function public.update_match_result_organizer(uuid, integer, integer, jsonb, jsonb, jsonb) from anon;
grant execute on function public.update_match_result_organizer(uuid, integer, integer, jsonb, jsonb, jsonb) to authenticated;
