-- Post-match rating flow:
-- 1) New notification delivery type: post_match_rating_reminder (+15 minutes after finished)
-- 2) Aggregate-first rating persistence (no per-rater per-player history)

alter table public.notification_deliveries
  add column if not exists scheduled_for timestamptz;

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_type_check;

alter table public.notification_deliveries
  add constraint notification_deliveries_type_check
  check (
    type in (
      'initial',
      'reminder',
      'match_cancelled',
      'venue_change',
      'lineup_published',
      'payment_reminder',
      'post_match_rating_reminder'
    )
  );

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_reminder_date_chk;

alter table public.notification_deliveries
  add constraint notification_deliveries_reminder_date_chk check (
    (
      type in (
        'initial',
        'match_cancelled',
        'venue_change',
        'lineup_published'
      )
      and reminder_date is null
    )
    or (type in ('reminder', 'payment_reminder', 'post_match_rating_reminder') and reminder_date is not null)
  );

create unique index if not exists notification_deliveries_unique_post_match_rating_reminder
  on public.notification_deliveries (match_id, recipient_id, token)
  where type = 'post_match_rating_reminder';

create index if not exists notification_deliveries_pending_scheduled_idx
  on public.notification_deliveries (scheduled_for, created_at)
  where status = 'pending';

comment on column public.profiles.notification_preferences is
  'JSON: push_enabled, types.group_match_initial|group_match_reminder|group_match_cancelled|group_match_venue_change|group_match_lineup_published|group_match_payment_reminder|group_match_post_match_rating_reminder, quiet_hours. Omitted keys default to enabled.';

create or replace function public.notification_delivery_allowed(
  p_prefs jsonb,
  p_delivery_type text
) returns boolean
language sql
stable
as $$
  select case
    when not public.coalesce_notification_pref_bool(p_prefs->'push_enabled', true) then false
    when p_delivery_type = 'initial' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_initial',
      true
    )
    when p_delivery_type = 'reminder' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_reminder',
      true
    )
    when p_delivery_type = 'match_cancelled' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_cancelled',
      true
    )
    when p_delivery_type = 'venue_change' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_venue_change',
      true
    )
    when p_delivery_type = 'lineup_published' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_lineup_published',
      true
    )
    when p_delivery_type = 'payment_reminder' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_payment_reminder',
      true
    )
    when p_delivery_type = 'post_match_rating_reminder' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_post_match_rating_reminder',
      true
    )
    else true
  end;
$$;

comment on function public.notification_delivery_allowed(jsonb, text) is
  'Whether enqueue should create a delivery for this prefs blob and delivery type (initial|reminder|match_cancelled|venue_change|lineup_published|payment_reminder|post_match_rating_reminder).';

create or replace function public.handle_match_status_finished_rating_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Istanbul')::date;
begin
  if new.group_id is null then
    return new;
  end if;

  if new.status = 'finished'::public.match_status
     and old.status is distinct from 'finished'::public.match_status then
    insert into public.notification_deliveries
      (match_id, group_id, recipient_id, token, type, reminder_date, scheduled_for)
    select
      new.id,
      new.group_id,
      a.player_id,
      pt.token,
      'post_match_rating_reminder',
      v_today,
      now() + interval '15 minutes'
    from public.match_attendees a
    join public.push_tokens pt on pt.user_id = a.player_id and pt.is_active = true
    join public.profiles pr on pr.id = a.player_id
    where a.match_id = new.id
      and a.status = 'going'::public.rsvp_status
      and a.player_id <> new.organizer_id
      and public.notification_delivery_allowed(pr.notification_preferences, 'post_match_rating_reminder')
    on conflict (match_id, recipient_id, token) where (type = 'post_match_rating_reminder') do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists matches_on_finished_enqueue_post_match_rating on public.matches;

create trigger matches_on_finished_enqueue_post_match_rating
after update of status on public.matches
for each row
execute procedure public.handle_match_status_finished_rating_notifications();

drop function if exists public.claim_pending_deliveries(integer);

create function public.claim_pending_deliveries(p_limit int default 50)
returns table (
  delivery_id uuid,
  delivery_token text,
  match_id uuid,
  group_id uuid,
  recipient_id uuid,
  delivery_type text,
  reminder_date date,
  match_starts_at timestamptz,
  match_venue text,
  group_name text,
  organizer_display_name text
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 50), 500));
begin
  update public.notification_deliveries
  set status = 'pending', claimed_at = null
  where status = 'sending'
    and claimed_at is not null
    and claimed_at < now() - interval '5 minutes';

  return query
  with claimed as (
    update public.notification_deliveries nd
    set status = 'sending', claimed_at = now()
    where nd.id in (
      select inner_nd.id
      from public.notification_deliveries inner_nd
      where inner_nd.status = 'pending'
        and (inner_nd.scheduled_for is null or inner_nd.scheduled_for <= now())
      order by coalesce(inner_nd.scheduled_for, inner_nd.created_at), inner_nd.created_at
      limit v_limit
      for update skip locked
    )
    returning nd.*
  )
  select
    c.id,
    c.token,
    c.match_id,
    c.group_id,
    c.recipient_id,
    c.type,
    c.reminder_date,
    m.starts_at,
    m.venue,
    g.name,
    op.display_name
  from claimed c
  left join public.matches m on m.id = c.match_id
  left join public.groups g on g.id = c.group_id
  left join public.profiles op on op.id = m.organizer_id;
end;
$$;

grant execute on function public.claim_pending_deliveries(int) to service_role;

create table if not exists public.match_player_rating_aggregates (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  score_total integer not null default 0,
  vote_count integer not null default 0,
  avg_score_100 numeric(5,2) generated always as (
    case when vote_count > 0 then (score_total::numeric / vote_count::numeric) else null end
  ) stored,
  updated_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

create index if not exists match_player_rating_aggregates_player_idx
  on public.match_player_rating_aggregates (player_id);

create trigger match_player_rating_aggregates_set_updated_at
before update on public.match_player_rating_aggregates
for each row execute procedure public.set_updated_at();

create table if not exists public.player_rating_aggregates (
  player_id uuid primary key references public.profiles (id) on delete cascade,
  score_total integer not null default 0,
  vote_count integer not null default 0,
  avg_score_100 numeric(5,2) generated always as (
    case when vote_count > 0 then (score_total::numeric / vote_count::numeric) else null end
  ) stored,
  motm_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create trigger player_rating_aggregates_set_updated_at
before update on public.player_rating_aggregates
for each row execute procedure public.set_updated_at();

create table if not exists public.match_rating_submissions (
  match_id uuid not null references public.matches (id) on delete cascade,
  rater_id uuid not null references public.profiles (id) on delete cascade,
  submitted_at timestamptz not null default now(),
  primary key (match_id, rater_id)
);

alter table public.match_rating_submissions enable row level security;

drop policy if exists match_rating_submissions_select_own on public.match_rating_submissions;

create policy match_rating_submissions_select_own on public.match_rating_submissions
for select to authenticated using (rater_id = auth.uid());

grant select on table public.match_rating_submissions to authenticated;
grant all on table public.match_rating_submissions to service_role;
grant all on table public.match_player_rating_aggregates to service_role;
grant all on table public.player_rating_aggregates to service_role;

drop function if exists public.upsert_match_peer_ratings(uuid, jsonb);

create function public.upsert_match_peer_ratings(p_match_id uuid, p_scores jsonb)
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
    raise exception 'Oturum gerekli';
  end if;

  if not public.match_rating_rater_can_participate(p_match_id, uid) then
    raise exception 'Bu maç için derecelendirme yapılamaz';
  end if;

  select m.status into st from public.matches m where m.id = p_match_id;
  if st is null then
    raise exception 'Maç bulunamadı';
  end if;
  if st <> 'finished'::public.match_status then
    raise exception 'Derecelendirme yalnızca bitmiş maçlarda yapılabilir';
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
      raise exception 'Geçersiz oyuncu seçimi';
    end if;
    if sc is null or sc < 0 or sc > 100 then
      raise exception 'Puan 0 ile 100 arasında olmalı';
    end if;
    if not public.match_rating_ratee_is_eligible(p_match_id, pid) then
      raise exception 'Bu oyuncu bu maç için derecelendirilemez';
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

drop function if exists public.upsert_match_motm_vote(uuid, uuid);

create function public.upsert_match_motm_vote(p_match_id uuid, p_pick_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  st public.match_status;
  prev_pick uuid;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;

  if not public.match_rating_rater_can_participate(p_match_id, uid) then
    raise exception 'Bu maç için oy kullanamazsınız';
  end if;

  if p_pick_player_id is null or p_pick_player_id = uid then
    raise exception 'Maçın adamı için geçerli bir oyuncu seçin';
  end if;

  select m.status into st from public.matches m where m.id = p_match_id;
  if st is null then
    raise exception 'Maç bulunamadı';
  end if;
  if st <> 'finished'::public.match_status then
    raise exception 'Oy yalnızca bitmiş maçlarda kullanılabilir';
  end if;

  if not public.match_rating_ratee_is_eligible(p_match_id, p_pick_player_id) then
    raise exception 'Seçilen oyuncu bu maçta yer almıyor';
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

drop function if exists public.get_match_rating_public_summary(uuid);

create function public.get_match_rating_public_summary(p_match_id uuid)
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
      when exists (select 1 from chk) then jsonb_build_object('players', pj.players, 'motm', mj.motm)
      else null::jsonb
    end
  from players_json pj
  cross join motm_json mj;
$$;

create or replace function public.submit_match_ratings_bundle(
  p_match_id uuid,
  p_scores jsonb,
  p_motm_pick_player_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.upsert_match_peer_ratings(p_match_id, p_scores);
  perform public.upsert_match_motm_vote(p_match_id, p_motm_pick_player_id);
end;
$$;

insert into public.match_player_rating_aggregates (match_id, player_id, score_total, vote_count)
select
  r.match_id,
  r.ratee_id,
  sum(r.score)::int,
  count(*)::int
from public.match_peer_ratings r
group by r.match_id, r.ratee_id
on conflict (match_id, player_id) do update
  set score_total = excluded.score_total,
      vote_count = excluded.vote_count;

insert into public.player_rating_aggregates (player_id, score_total, vote_count, motm_count)
select
  x.player_id,
  x.score_total,
  x.vote_count,
  coalesce(m.motm_count, 0) as motm_count
from (
  select
    r.ratee_id as player_id,
    sum(r.score)::int as score_total,
    count(*)::int as vote_count
  from public.match_peer_ratings r
  group by r.ratee_id
) x
left join (
  select v.pick_player_id as player_id, count(*)::int as motm_count
  from public.match_motm_votes v
  group by v.pick_player_id
) m
  on m.player_id = x.player_id
on conflict (player_id) do update
  set score_total = excluded.score_total,
      vote_count = excluded.vote_count,
      motm_count = excluded.motm_count;

grant execute on function public.handle_match_status_finished_rating_notifications() to authenticated;
grant execute on function public.upsert_match_peer_ratings (uuid, jsonb) to authenticated;
grant execute on function public.upsert_match_motm_vote (uuid, uuid) to authenticated;
grant execute on function public.get_match_rating_public_summary (uuid) to authenticated;
grant execute on function public.submit_match_ratings_bundle (uuid, jsonb, uuid) to authenticated;
