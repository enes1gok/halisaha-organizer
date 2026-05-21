-- Migration: Rating Manual Close by Organizer
--
-- New behavior:
--   1. Rating window opens automatically when match starts (starts_at <= now()).
--   2. Only the organizer can close the rating window via close_match_rating().
--   3. submit_match_result no longer sets rating_window_ends_at (rating_window_ends_at
--      remains on the table for backward compatibility with old matches; it is not set
--      for matches created after this migration).
--
-- Changes:
--   1. matches.rating_closed_at (new column) — set by organizer, null = still open.
--   2. upsert_match_peer_ratings — gate changed: starts_at <= now() + rating_closed_at IS NULL.
--   3. upsert_match_motm_vote — same gate change.
--   4. get_match_rating_public_summary — includes rating_closed_at; rating_window_closed
--      now checks both old (rating_window_ends_at) and new (rating_closed_at) semantics.
--   5. close_match_rating (new RPC) — organizer-only, idempotent.
--   6. submit_match_result — no longer sets rating_window_ends_at.
--   7. All match_graph functions — RETURNS TABLE extended with rating_closed_at.
--
-- ERR tokens added: ERR_MATCH_NOT_STARTED, ERR_RATING_ALREADY_OPEN (reserved, unused).

-- ── 1. New column ─────────────────────────────────────────────────────────────

alter table public.matches
  add column if not exists rating_closed_at timestamptz;

-- ── 2. upsert_match_peer_ratings ──────────────────────────────────────────────

drop function if exists public.upsert_match_peer_ratings(uuid, jsonb);

create function public.upsert_match_peer_ratings(p_match_id uuid, p_scores jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_starts_at timestamptz;
  v_closed_at timestamptz;
  v_status public.match_status;
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

  select m.starts_at, m.rating_closed_at, m.status
  into v_starts_at, v_closed_at, v_status
  from public.matches m
  where m.id = p_match_id;

  if v_starts_at is null then
    perform public.raise_app_error('ERR_MATCH_NOT_FOUND');
  end if;

  if v_status = 'cancelled'::public.match_status then
    perform public.raise_app_error('ERR_MATCH_NOT_FOUND');
  end if;

  -- Rating opens when match starts
  if now() < v_starts_at then
    perform public.raise_app_error('ERR_MATCH_NOT_STARTED');
  end if;

  -- Organizer manually closed the rating window
  if v_closed_at is not null then
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

revoke execute on function public.upsert_match_peer_ratings(uuid, jsonb) from public;
revoke execute on function public.upsert_match_peer_ratings(uuid, jsonb) from anon;
grant execute on function public.upsert_match_peer_ratings(uuid, jsonb) to authenticated;

-- ── 3. upsert_match_motm_vote ─────────────────────────────────────────────────

create or replace function public.upsert_match_motm_vote(p_match_id uuid, p_pick_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_starts_at timestamptz;
  v_closed_at timestamptz;
  v_status public.match_status;
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

  select m.starts_at, m.rating_closed_at, m.status
  into v_starts_at, v_closed_at, v_status
  from public.matches m
  where m.id = p_match_id;

  if v_starts_at is null then
    perform public.raise_app_error('ERR_MATCH_NOT_FOUND');
  end if;

  if v_status = 'cancelled'::public.match_status then
    perform public.raise_app_error('ERR_MATCH_NOT_FOUND');
  end if;

  if now() < v_starts_at then
    perform public.raise_app_error('ERR_MATCH_NOT_STARTED');
  end if;

  if v_closed_at is not null then
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

revoke execute on function public.upsert_match_motm_vote(uuid, uuid) from public;
revoke execute on function public.upsert_match_motm_vote(uuid, uuid) from anon;
grant execute on function public.upsert_match_motm_vote(uuid, uuid) to authenticated;

-- ── 4. get_match_rating_public_summary — includes rating_closed_at ────────────

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
    select m.rating_window_ends_at, m.rating_closed_at, m.starts_at
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
          'rating_closed_at', w.rating_closed_at,
          -- Closed if: organizer manually closed (new) OR old auto-close window elapsed
          'rating_window_closed', (
            w.rating_closed_at is not null
            or (w.rating_window_ends_at is not null and now() > w.rating_window_ends_at)
          )
        )
      else null::jsonb
    end
  from players_json pj
  cross join motm_json mj
  cross join win w;
$$;

revoke execute on function public.get_match_rating_public_summary(uuid) from public;
revoke execute on function public.get_match_rating_public_summary(uuid) from anon;
grant execute on function public.get_match_rating_public_summary(uuid) to authenticated;

-- ── 5. close_match_rating (new RPC) ──────────────────────────────────────────

create or replace function public.close_match_rating(p_match_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_organizer_id uuid;
  v_starts_at timestamptz;
  v_closed_at timestamptz;
begin
  select m.organizer_id, m.starts_at, m.rating_closed_at
  into v_organizer_id, v_starts_at, v_closed_at
  from public.matches m
  where m.id = p_match_id;

  if v_organizer_id is null then
    perform public.raise_app_error('ERR_MATCH_NOT_FOUND');
  end if;

  if auth.uid() is null or auth.uid() <> v_organizer_id then
    perform public.raise_app_error('ERR_NOT_AUTHORIZED');
  end if;

  -- Idempotent: already closed
  if v_closed_at is not null then
    return;
  end if;

  if now() < v_starts_at then
    perform public.raise_app_error('ERR_MATCH_NOT_STARTED');
  end if;

  update public.matches
  set rating_closed_at = now()
  where id = p_match_id;
end;
$$;

revoke all on function public.close_match_rating(uuid) from public;
revoke all on function public.close_match_rating(uuid) from anon;
grant execute on function public.close_match_rating(uuid) to authenticated;

-- ── 6. submit_match_result — no longer sets rating_window_ends_at ─────────────
-- Signature unchanged; rating window now opens at match start, not score submission.

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
    updated_at = now()
  where id = p_match_id;
  -- NOTE: rating_window_ends_at is intentionally NOT set here.
  -- Rating window opens at starts_at and closes via close_match_rating().

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

revoke execute on function public.submit_match_result(uuid, int, int, jsonb, jsonb, jsonb) from public;
revoke execute on function public.submit_match_result(uuid, int, int, jsonb, jsonb, jsonb) from anon;
grant execute on function public.submit_match_result(uuid, int, int, jsonb, jsonb, jsonb) to authenticated;

-- ── 7. Match-graph functions — add rating_closed_at to RETURNS TABLE ──────────
-- Drop in dependency order (dependents first), then recreate.

drop function if exists public.list_match_graphs_for_match_ids(uuid[]);
drop function if exists public.list_visible_match_summaries_for_user(integer, timestamptz, uuid);
drop function if exists public.list_visible_match_graphs_for_user(integer, timestamptz, uuid);
drop function if exists public.get_match_graph_for_user(uuid);
drop function if exists public.match_graph_row(uuid);
drop function if exists public.match_graph_row_body(uuid);
drop function if exists public.match_graph_row_summary_body(uuid);

-- ── match_graph_row_body ──────────────────────────────────────────────────────

create function public.match_graph_row_body(p_match_id uuid)
returns table (
  id uuid,
  starts_at timestamptz,
  venue text,
  organizer_id uuid,
  max_players int,
  price_per_person numeric,
  iban text,
  iban_account_name text,
  payment_note text,
  payment_method text,
  join_code text,
  lineup_locked boolean,
  lineup_formation_id text,
  self_report_enabled boolean,
  status public.match_status,
  score_a int,
  score_b int,
  rating_window_ends_at timestamptz,
  rating_closed_at timestamptz,
  group_id uuid,
  series_id uuid,
  spawned_from_match_id uuid,
  attendees jsonb,
  team_players jsonb,
  stat_lines jsonb,
  self_reports jsonb,
  profiles jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with m as (
    select
      mt.id,
      mt.starts_at,
      mt.venue,
      mt.organizer_id,
      mt.max_players,
      mt.price_per_person,
      mt.iban,
      mt.join_code,
      mt.lineup_locked,
      mt.lineup_formation_id,
      mt.self_report_enabled,
      mt.status,
      mt.score_a,
      mt.score_b,
      mt.rating_window_ends_at,
      mt.rating_closed_at,
      mt.group_id,
      mt.series_id,
      mt.spawned_from_match_id,
      mt.payment_method::text as payment_method,
      mt.iban_account_name,
      mt.payment_note
    from public.matches mt
    where mt.id = p_match_id
  ),
  att as (
    select a.match_id, a.player_id, a.status, a.paid
    from public.match_attendees a
    inner join m on m.id = a.match_id
  ),
  mtp as (
    select t.match_id, t.player_id, t.team, t.slot_index
    from public.match_team_players t
    inner join m on m.id = t.match_id
    order by t.team, t.slot_index nulls last, t.player_id
  ),
  msl as (
    select s.match_id, s.player_id, s.kind, s.count
    from public.match_stat_lines s
    inner join m on m.id = s.match_id and m.status = 'finished'::public.match_status
  ),
  srr as (
    select sr.id, sr.match_id, sr.player_id, sr.type, sr.status
    from public.self_report_requests sr
    inner join m on m.id = sr.match_id
  ),
  profile_ids as (
    select m.organizer_id as player_id from m
    union
    select att.player_id from att
    union
    select mtp.player_id from mtp
    union
    select msl.player_id from msl
    union
    select srr.player_id from srr
  )
  select
    m.id,
    m.starts_at,
    m.venue,
    m.organizer_id,
    m.max_players,
    m.price_per_person,
    m.iban,
    m.iban_account_name,
    m.payment_note,
    m.payment_method,
    m.join_code,
    m.lineup_locked,
    m.lineup_formation_id,
    m.self_report_enabled,
    m.status,
    m.score_a,
    m.score_b,
    m.rating_window_ends_at,
    m.rating_closed_at,
    case
      when m.group_id is not null and public.can_view_group(m.group_id, auth.uid()) then m.group_id
      else null::uuid
    end as group_id,
    case
      when m.series_id is not null then (
        select case
          when public.can_view_group(gws.group_id, auth.uid()) then m.series_id
          else null::uuid
        end
        from public.group_weekly_series gws
        where gws.id = m.series_id
      )
      else null::uuid
    end as series_id,
    case
      when m.spawned_from_match_id is not null
        and public.can_view_match(m.spawned_from_match_id, auth.uid())
      then m.spawned_from_match_id
      else null::uuid
    end as spawned_from_match_id,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'match_id', a.match_id,
          'player_id', a.player_id,
          'status', a.status,
          'paid', a.paid
        )
      )
      from att a
    ), '[]'::jsonb) as attendees,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'match_id', t.match_id,
          'player_id', t.player_id,
          'team', t.team,
          'slot_index', t.slot_index
        )
      )
      from mtp t
    ), '[]'::jsonb) as team_players,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'match_id', s.match_id,
          'player_id', s.player_id,
          'kind', s.kind,
          'count', s.count
        )
      )
      from msl s
    ), '[]'::jsonb) as stat_lines,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', sr.id,
          'match_id', sr.match_id,
          'player_id', sr.player_id,
          'type', sr.type,
          'status', sr.status
        )
      )
      from srr sr
    ), '[]'::jsonb) as self_reports,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'display_name', p.display_name,
          'photo_uri', p.photo_uri,
          'position', p.position,
          'preferred_foot', p.preferred_foot,
          'updated_at', p.updated_at
        )
      )
      from public.profiles_public p
      inner join profile_ids pid on pid.player_id = p.id
    ), '[]'::jsonb) as profiles
  from m;
$$;

revoke execute on function public.match_graph_row_body(uuid) from public;
revoke execute on function public.match_graph_row_body(uuid) from anon;
revoke execute on function public.match_graph_row_body(uuid) from authenticated;

-- ── match_graph_row_summary_body ──────────────────────────────────────────────

create function public.match_graph_row_summary_body(p_match_id uuid)
returns table (
  id uuid,
  starts_at timestamptz,
  venue text,
  organizer_id uuid,
  max_players int,
  price_per_person numeric,
  iban text,
  iban_account_name text,
  payment_note text,
  payment_method text,
  join_code text,
  lineup_locked boolean,
  lineup_formation_id text,
  self_report_enabled boolean,
  status public.match_status,
  score_a int,
  score_b int,
  rating_window_ends_at timestamptz,
  rating_closed_at timestamptz,
  group_id uuid,
  series_id uuid,
  spawned_from_match_id uuid,
  attendees jsonb,
  team_players jsonb,
  stat_lines jsonb,
  self_reports jsonb,
  profiles jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with m as (
    select
      mt.id,
      mt.starts_at,
      mt.venue,
      mt.organizer_id,
      mt.max_players,
      mt.price_per_person,
      mt.iban,
      mt.join_code,
      mt.lineup_locked,
      mt.lineup_formation_id,
      mt.self_report_enabled,
      mt.status,
      mt.score_a,
      mt.score_b,
      mt.rating_window_ends_at,
      mt.rating_closed_at,
      mt.group_id,
      mt.series_id,
      mt.spawned_from_match_id,
      mt.payment_method::text as payment_method,
      mt.iban_account_name,
      mt.payment_note
    from public.matches mt
    where mt.id = p_match_id
  ),
  att as (
    select a.match_id, a.player_id, a.status, a.paid
    from public.match_attendees a
    inner join m on m.id = a.match_id
  ),
  mtp as (
    select t.match_id, t.player_id, t.team, t.slot_index
    from public.match_team_players t
    inner join m on m.id = t.match_id
    order by t.team, t.slot_index nulls last, t.player_id
  ),
  profile_ids as (
    select m.organizer_id as player_id from m
    union
    select att.player_id from att
    union
    select mtp.player_id from mtp
  )
  select
    m.id,
    m.starts_at,
    m.venue,
    m.organizer_id,
    m.max_players,
    m.price_per_person,
    m.iban,
    m.iban_account_name,
    m.payment_note,
    m.payment_method,
    m.join_code,
    m.lineup_locked,
    m.lineup_formation_id,
    m.self_report_enabled,
    m.status,
    m.score_a,
    m.score_b,
    m.rating_window_ends_at,
    m.rating_closed_at,
    case
      when m.group_id is not null and public.can_view_group(m.group_id, auth.uid()) then m.group_id
      else null::uuid
    end as group_id,
    case
      when m.series_id is not null then (
        select case
          when public.can_view_group(gws.group_id, auth.uid()) then m.series_id
          else null::uuid
        end
        from public.group_weekly_series gws
        where gws.id = m.series_id
      )
      else null::uuid
    end as series_id,
    case
      when m.spawned_from_match_id is not null
        and public.can_view_match(m.spawned_from_match_id, auth.uid())
      then m.spawned_from_match_id
      else null::uuid
    end as spawned_from_match_id,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'match_id', a.match_id,
          'player_id', a.player_id,
          'status', a.status,
          'paid', a.paid
        )
      )
      from att a
    ), '[]'::jsonb) as attendees,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'match_id', t.match_id,
          'player_id', t.player_id,
          'team', t.team,
          'slot_index', t.slot_index
        )
      )
      from mtp t
    ), '[]'::jsonb) as team_players,
    '[]'::jsonb as stat_lines,
    '[]'::jsonb as self_reports,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'display_name', p.display_name,
          'photo_uri', p.photo_uri,
          'position', p.position,
          'preferred_foot', p.preferred_foot,
          'updated_at', p.updated_at
        )
      )
      from public.profiles_public p
      inner join profile_ids pid on pid.player_id = p.id
    ), '[]'::jsonb) as profiles
  from m;
$$;

revoke execute on function public.match_graph_row_summary_body(uuid) from public;
revoke execute on function public.match_graph_row_summary_body(uuid) from anon;
revoke execute on function public.match_graph_row_summary_body(uuid) from authenticated;

-- ── match_graph_row ───────────────────────────────────────────────────────────

create function public.match_graph_row(p_match_id uuid)
returns table (
  id uuid,
  starts_at timestamptz,
  venue text,
  organizer_id uuid,
  max_players int,
  price_per_person numeric,
  iban text,
  iban_account_name text,
  payment_note text,
  payment_method text,
  join_code text,
  lineup_locked boolean,
  lineup_formation_id text,
  self_report_enabled boolean,
  status public.match_status,
  score_a int,
  score_b int,
  rating_window_ends_at timestamptz,
  rating_closed_at timestamptz,
  group_id uuid,
  series_id uuid,
  spawned_from_match_id uuid,
  attendees jsonb,
  team_players jsonb,
  stat_lines jsonb,
  self_reports jsonb,
  profiles jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select b.*
  from public.match_graph_row_body(p_match_id) b
  where public.can_view_match(p_match_id, auth.uid());
$$;

revoke execute on function public.match_graph_row(uuid) from public;
revoke execute on function public.match_graph_row(uuid) from anon;
revoke execute on function public.match_graph_row(uuid) from authenticated;

-- ── get_match_graph_for_user ──────────────────────────────────────────────────

create function public.get_match_graph_for_user(p_match_id uuid)
returns table (
  id uuid,
  starts_at timestamptz,
  venue text,
  organizer_id uuid,
  max_players int,
  price_per_person numeric,
  iban text,
  iban_account_name text,
  payment_note text,
  payment_method text,
  join_code text,
  lineup_locked boolean,
  lineup_formation_id text,
  self_report_enabled boolean,
  status public.match_status,
  score_a int,
  score_b int,
  rating_window_ends_at timestamptz,
  rating_closed_at timestamptz,
  group_id uuid,
  series_id uuid,
  spawned_from_match_id uuid,
  attendees jsonb,
  team_players jsonb,
  stat_lines jsonb,
  self_reports jsonb,
  profiles jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select * from public.match_graph_row(p_match_id);
$$;

revoke execute on function public.get_match_graph_for_user(uuid) from public;
revoke execute on function public.get_match_graph_for_user(uuid) from anon;
grant execute on function public.get_match_graph_for_user(uuid) to authenticated;

-- ── list_visible_match_graphs_for_user ───────────────────────────────────────

create function public.list_visible_match_graphs_for_user(
  p_limit integer default null,
  p_after_starts_at timestamptz default null,
  p_after_id uuid default null
)
returns table (
  id uuid,
  starts_at timestamptz,
  venue text,
  organizer_id uuid,
  max_players int,
  price_per_person numeric,
  iban text,
  iban_account_name text,
  payment_note text,
  payment_method text,
  join_code text,
  lineup_locked boolean,
  lineup_formation_id text,
  self_report_enabled boolean,
  status public.match_status,
  score_a int,
  score_b int,
  rating_window_ends_at timestamptz,
  rating_closed_at timestamptz,
  group_id uuid,
  series_id uuid,
  spawned_from_match_id uuid,
  attendees jsonb,
  team_players jsonb,
  stat_lines jsonb,
  self_reports jsonb,
  profiles jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select mg.*
  from public.matches m
  cross join lateral public.match_graph_row_body(m.id) as mg
  where public.can_view_match(m.id, auth.uid())
    and (
      p_after_starts_at is null
      or mg.starts_at < p_after_starts_at
      or (mg.starts_at = p_after_starts_at and mg.id < p_after_id)
    )
  order by mg.starts_at desc, mg.id desc
  limit p_limit;
$$;

revoke execute on function public.list_visible_match_graphs_for_user(integer, timestamptz, uuid) from public;
revoke execute on function public.list_visible_match_graphs_for_user(integer, timestamptz, uuid) from anon;
grant execute on function public.list_visible_match_graphs_for_user(integer, timestamptz, uuid) to authenticated;

-- ── list_visible_match_summaries_for_user ────────────────────────────────────

create function public.list_visible_match_summaries_for_user(
  p_limit integer default null,
  p_after_starts_at timestamptz default null,
  p_after_id uuid default null
)
returns table (
  id uuid,
  starts_at timestamptz,
  venue text,
  organizer_id uuid,
  max_players int,
  price_per_person numeric,
  iban text,
  iban_account_name text,
  payment_note text,
  payment_method text,
  join_code text,
  lineup_locked boolean,
  lineup_formation_id text,
  self_report_enabled boolean,
  status public.match_status,
  score_a int,
  score_b int,
  rating_window_ends_at timestamptz,
  rating_closed_at timestamptz,
  group_id uuid,
  series_id uuid,
  spawned_from_match_id uuid,
  attendees jsonb,
  team_players jsonb,
  stat_lines jsonb,
  self_reports jsonb,
  profiles jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select mg.*
  from public.matches m
  cross join lateral public.match_graph_row_summary_body(m.id) as mg
  where public.can_view_match(m.id, auth.uid())
    and (
      p_after_starts_at is null
      or mg.starts_at < p_after_starts_at
      or (mg.starts_at = p_after_starts_at and mg.id < p_after_id)
    )
  order by mg.starts_at desc, mg.id desc
  limit p_limit;
$$;

revoke execute on function public.list_visible_match_summaries_for_user(integer, timestamptz, uuid) from public;
revoke execute on function public.list_visible_match_summaries_for_user(integer, timestamptz, uuid) from anon;
grant execute on function public.list_visible_match_summaries_for_user(integer, timestamptz, uuid) to authenticated;

-- ── list_match_graphs_for_match_ids ──────────────────────────────────────────

create function public.list_match_graphs_for_match_ids(p_match_ids uuid[])
returns table (
  id uuid,
  starts_at timestamptz,
  venue text,
  organizer_id uuid,
  max_players int,
  price_per_person numeric,
  iban text,
  iban_account_name text,
  payment_note text,
  payment_method text,
  join_code text,
  lineup_locked boolean,
  lineup_formation_id text,
  self_report_enabled boolean,
  status public.match_status,
  score_a int,
  score_b int,
  rating_window_ends_at timestamptz,
  rating_closed_at timestamptz,
  group_id uuid,
  series_id uuid,
  spawned_from_match_id uuid,
  attendees jsonb,
  team_players jsonb,
  stat_lines jsonb,
  self_reports jsonb,
  profiles jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select mg.*
  from unnest(coalesce(p_match_ids, array[]::uuid[])) as req(id)
  cross join lateral public.match_graph_row(req.id) as mg;
$$;

revoke execute on function public.list_match_graphs_for_match_ids(uuid[]) from public;
revoke execute on function public.list_match_graphs_for_match_ids(uuid[]) from anon;
grant execute on function public.list_match_graphs_for_match_ids(uuid[]) to authenticated;
