-- Own goals (stat_line_kind) + submit_match_result(p_own_goals) + immediate drain after score save

do $$
begin
  alter type public.stat_line_kind add value 'own_goal';
exception
  when duplicate_object then
    null;
end $$;

drop function if exists public.submit_match_result(uuid, integer, integer, jsonb, jsonb);

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

  perform public.spawn_next_weekly_match(p_match_id);
  perform public.drain_notification_deliveries();
end;
$$;

revoke execute on function public.submit_match_result(uuid, integer, integer, jsonb, jsonb, jsonb) from public;
revoke execute on function public.submit_match_result(uuid, integer, integer, jsonb, jsonb, jsonb) from anon;
grant execute on function public.submit_match_result(uuid, integer, integer, jsonb, jsonb, jsonb) to authenticated;

grant execute on function public.drain_notification_deliveries() to postgres;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    grant execute on function public.drain_notification_deliveries() to supabase_admin;
  end if;
end $$;
