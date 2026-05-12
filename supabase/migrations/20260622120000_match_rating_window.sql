-- Migration: Match rating window (2-hour post-match peer rating period).
--
-- ERR tokens added: ERR_RATING_WINDOW_CLOSED
--
-- Changes:
--   1. matches.rating_window_ends_at — set by submit_match_result, null for older matches.
--   2. submit_match_result — sets rating_window_ends_at = now() + 2h on score submission.
--   3. upsert_match_peer_ratings — hard-gate: raises ERR_RATING_WINDOW_CLOSED if window elapsed.
--   4. upsert_match_motm_vote   — same hard-gate.
--   5. get_match_rating_public_summary — adds rating_window_ends_at + rating_window_closed to response.

-- ── 1. Column ────────────────────────────────────────────────────────────────

alter table public.matches
  add column if not exists rating_window_ends_at timestamptz;

-- ── 2. submit_match_result ───────────────────────────────────────────────────

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
    public.can_manage_group_match(p_match_id, uid)
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
  from jsonb_array_elements(coalesce(p_scorers, '[]'::jsonb)) elem
  group by p_match_id, (elem ->> 'player_id')::uuid;

  insert into public.match_stat_lines (match_id, player_id, kind, count)
  select
    p_match_id,
    (elem ->> 'player_id')::uuid,
    'assist'::public.stat_line_kind,
    sum(greatest(1, coalesce((elem ->> 'count')::int, 1)))::int
  from jsonb_array_elements(coalesce(p_assists, '[]'::jsonb)) elem
  group by p_match_id, (elem ->> 'player_id')::uuid;

  insert into public.match_stat_lines (match_id, player_id, kind, count)
  select
    p_match_id,
    (elem ->> 'player_id')::uuid,
    'own_goal'::public.stat_line_kind,
    sum(greatest(1, coalesce((elem ->> 'count')::int, 1)))::int
  from jsonb_array_elements(coalesce(p_own_goals, '[]'::jsonb)) elem
  group by p_match_id, (elem ->> 'player_id')::uuid;

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

  update public.matches
  set
    score_a = p_score_a,
    score_b = p_score_b,
    status = 'finished'::public.match_status,
    rating_window_ends_at = now() + interval '2 hours',
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

  perform public.spawn_next_weekly_match(p_match_id);
  perform public.drain_notification_deliveries();
end;
$$;

revoke execute on function public.submit_match_result(uuid, integer, integer, jsonb, jsonb, jsonb) from public;
revoke execute on function public.submit_match_result(uuid, integer, integer, jsonb, jsonb, jsonb) from anon;
grant execute on function public.submit_match_result(uuid, integer, integer, jsonb, jsonb, jsonb) to authenticated;

-- ── 3. upsert_match_peer_ratings — window hard-gate ─────────────────────────

create or replace function public.upsert_match_peer_ratings(p_match_id uuid, p_scores jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  st public.match_status;
  win_ends timestamptz;
  elem jsonb;
  pid uuid;
  sc int;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;

  if not public.match_rating_rater_can_participate(p_match_id, uid) then
    perform public.raise_app_error('ERR_RATING_CANNOT_PARTICIPATE');
  end if;

  select m.status, m.rating_window_ends_at
  into st, win_ends
  from public.matches m
  where m.id = p_match_id;

  if st is null then
    perform public.raise_app_error('ERR_MATCH_NOT_FOUND');
  end if;

  if st <> 'finished'::public.match_status then
    perform public.raise_app_error('ERR_RATING_FINISHED_ONLY');
  end if;

  if win_ends is not null and now() > win_ends then
    perform public.raise_app_error('ERR_RATING_WINDOW_CLOSED');
  end if;

  if exists (
    select 1 from public.match_rating_submissions s
    where s.match_id = p_match_id and s.rater_id = uid
  ) then
    raise exception 'Bu maç için puanlamayı zaten gönderdiniz';
  end if;

  for elem in select * from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb))
  loop
    pid := (elem ->> 'ratee_id')::uuid;
    sc := (elem ->> 'score')::int;
    if pid is null or pid = uid then
      perform public.raise_app_error('ERR_RATING_INVALID_RATEE');
    end if;
    if sc is null or sc < 0 or sc > 100 then
      perform public.raise_app_error('ERR_RATING_SCORE_RANGE');
    end if;
    if not public.match_rating_ratee_is_eligible(p_match_id, pid) then
      perform public.raise_app_error('ERR_RATING_RATEE_INELIGIBLE');
    end if;
  end loop;

  insert into public.match_rating_submissions (match_id, rater_id)
  values (p_match_id, uid);

  for elem in select * from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb))
  loop
    pid := (elem ->> 'ratee_id')::uuid;
    sc := (elem ->> 'score')::int;

    insert into public.match_player_rating_aggregates (
      match_id,
      player_id,
      score_total,
      vote_count
    )
    values (p_match_id, pid, sc, 1)
    on conflict (match_id, player_id) do update
      set score_total = public.match_player_rating_aggregates.score_total + excluded.score_total,
          vote_count = public.match_player_rating_aggregates.vote_count + excluded.vote_count;

    insert into public.player_rating_aggregates (
      player_id,
      score_total,
      vote_count
    )
    values (pid, sc, 1)
    on conflict (player_id) do update
      set score_total = public.player_rating_aggregates.score_total + excluded.score_total,
          vote_count = public.player_rating_aggregates.vote_count + excluded.vote_count;
  end loop;
end;
$$;

grant execute on function public.upsert_match_peer_ratings(uuid, jsonb) to authenticated;

-- ── 4. upsert_match_motm_vote — window hard-gate ─────────────────────────────

create or replace function public.upsert_match_motm_vote(p_match_id uuid, p_pick_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  st public.match_status;
  win_ends timestamptz;
  prev_pick uuid;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;

  if not public.match_rating_rater_can_participate(p_match_id, uid) then
    perform public.raise_app_error('ERR_MOTM_CANNOT_VOTE');
  end if;

  if p_pick_player_id is null or p_pick_player_id = uid then
    perform public.raise_app_error('ERR_MOTM_INVALID_PICK');
  end if;

  select m.status, m.rating_window_ends_at
  into st, win_ends
  from public.matches m
  where m.id = p_match_id;

  if st is null then
    perform public.raise_app_error('ERR_MATCH_NOT_FOUND');
  end if;

  if st <> 'finished'::public.match_status then
    perform public.raise_app_error('ERR_MOTM_FINISHED_ONLY');
  end if;

  if win_ends is not null and now() > win_ends then
    perform public.raise_app_error('ERR_RATING_WINDOW_CLOSED');
  end if;

  if not public.match_rating_ratee_is_eligible(p_match_id, p_pick_player_id) then
    perform public.raise_app_error('ERR_MOTM_PLAYER_NOT_ON_FIELD');
  end if;

  select pick_player_id
  into prev_pick
  from public.match_motm_votes
  where match_id = p_match_id
    and voter_id = uid;

  insert into public.match_motm_votes (match_id, voter_id, pick_player_id)
  values (p_match_id, uid, p_pick_player_id)
  on conflict (match_id, voter_id) do update
  set pick_player_id = excluded.pick_player_id,
      created_at = now();

  if prev_pick is distinct from p_pick_player_id then
    if prev_pick is not null then
      update public.player_rating_aggregates
      set motm_count = greatest(0, motm_count - 1)
      where player_id = prev_pick;
    end if;

    insert into public.player_rating_aggregates (player_id, motm_count)
    values (p_pick_player_id, 1)
    on conflict (player_id) do update
      set motm_count = public.player_rating_aggregates.motm_count + 1;
  end if;
end;
$$;

grant execute on function public.upsert_match_motm_vote(uuid, uuid) to authenticated;

-- ── 5. get_match_rating_public_summary — window fields ───────────────────────

create or replace function public.get_match_rating_public_summary(p_match_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with chk as (
    select 1 as ok
    where auth.uid() is not null
      and public.can_view_match(p_match_id, auth.uid())
  ),
  win as (
    select m.rating_window_ends_at
    from public.matches m
    where m.id = p_match_id
  ),
  elig as (
    select t.player_id
    from public.match_team_players t
    where t.match_id = p_match_id
  ),
  players_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'player_id', e.player_id,
          'avg', ma.avg_score_100,
          'votes_count', coalesce(ma.vote_count, 0),
          'overall_avg', pa.avg_score_100,
          'overall_votes_count', coalesce(pa.vote_count, 0),
          'overall_motm_count', coalesce(pa.motm_count, 0)
        )
        order by e.player_id
      ),
      '[]'::jsonb
    ) as players
    from elig e
    left join public.match_player_rating_aggregates ma
      on ma.match_id = p_match_id and ma.player_id = e.player_id
    left join public.player_rating_aggregates pa
      on pa.player_id = e.player_id
  ),
  motm_rank as (
    select v.pick_player_id as player_id, count(*)::int as votes
    from public.match_motm_votes v
    where v.match_id = p_match_id
    group by v.pick_player_id
  ),
  motm_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object('player_id', x.player_id, 'votes', x.votes)
        order by x.votes desc, x.player_id
      ),
      '[]'::jsonb
    ) as motm
    from motm_rank x
  )
  select case
      when exists (select 1 from chk) then
        jsonb_build_object(
          'players', pj.players,
          'motm', mj.motm,
          'rating_window_ends_at', w.rating_window_ends_at,
          'rating_window_closed', (w.rating_window_ends_at is not null and now() > w.rating_window_ends_at)
        )
      else null::jsonb
    end
  from players_json pj
  cross join motm_json mj
  cross join win w;
$$;

grant execute on function public.get_match_rating_public_summary(uuid) to authenticated;
