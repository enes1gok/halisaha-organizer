-- Weekly global match streak (Istanbul calendar weeks) + mid-week "streak at risk" push.
-- Product: streak increments on group match finished with RSVP going; risk enqueue Wednesday 19:00 TR.

-- ---------------------------------------------------------------------------
-- 1) Helper: Monday (date) of the Istanbul local week for a timestamptz
-- ---------------------------------------------------------------------------

create or replace function public.week_monday_istanbul(p_ts timestamptz)
returns date
language sql
immutable
parallel safe
set search_path = public
as $$
  select (date_trunc(
    'week',
    (p_ts at time zone 'Europe/Istanbul')
  ))::date;
$$;

comment on function public.week_monday_istanbul(timestamptz) is
  'ISO week start Monday in Europe/Istanbul local time for the instant p_ts.';

-- ---------------------------------------------------------------------------
-- 2) profiles: streak columns
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists weekly_match_streak_weeks integer not null default 0
    check (weekly_match_streak_weeks >= 0);

alter table public.profiles
  add column if not exists weekly_match_last_qualifying_week_start date null;

comment on column public.profiles.weekly_match_streak_weeks is
  'Ardışık hafta sayısı (grup maçı finished + going); hafta sınırı week_monday_istanbul(starts_at).';
comment on column public.profiles.weekly_match_last_qualifying_week_start is
  'Son haftanın Pazartesi tarihi (Istanbul) — streak güncellemesi için.';

-- ---------------------------------------------------------------------------
-- 3) notification_deliveries: nullable match/group for streak_at_risk + integrity
-- ---------------------------------------------------------------------------

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_match_group_ctx_chk;

alter table public.notification_deliveries
  alter column match_id drop not null;

alter table public.notification_deliveries
  alter column group_id drop not null;

alter table public.notification_deliveries
  add constraint notification_deliveries_match_group_ctx_chk check (
    (
      type = 'streak_at_risk'
      and match_id is null
      and group_id is null
    )
    or (
      type <> 'streak_at_risk'
      and match_id is not null
      and group_id is not null
    )
  );

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
      'post_match_rating_reminder',
      'match_result',
      'streak_at_risk'
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
        'lineup_published',
        'match_result'
      )
      and reminder_date is null
    )
    or (
      type in ('reminder', 'payment_reminder', 'post_match_rating_reminder', 'streak_at_risk')
      and reminder_date is not null
    )
  );

create unique index if not exists notification_deliveries_unique_streak_at_risk
  on public.notification_deliveries (recipient_id, token, reminder_date)
  where type = 'streak_at_risk';

-- ---------------------------------------------------------------------------
-- 4) Preferences + notification_delivery_allowed
-- ---------------------------------------------------------------------------

comment on column public.profiles.notification_preferences is
  'JSON: push_enabled, types.group_match_* incl. group_match_streak_at_risk, quiet_hours. Omitted keys default to enabled.';

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
    when p_delivery_type = 'match_result' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_match_result',
      true
    )
    when p_delivery_type = 'streak_at_risk' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_streak_at_risk',
      true
    )
    else true
  end;
$$;

comment on function public.notification_delivery_allowed(jsonb, text) is
  'Whether enqueue should create a delivery for this prefs blob and delivery type (includes streak_at_risk).';

-- ---------------------------------------------------------------------------
-- 5) Streak update when a group match becomes finished (going attendees)
-- ---------------------------------------------------------------------------

create or replace function public.apply_weekly_match_streak_on_match_finished()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start date;
  rec record;
  v_last date;
  v_streak int;
begin
  if new.group_id is null then
    return new;
  end if;

  if new.status is distinct from 'finished'::public.match_status
     or old.status = 'finished'::public.match_status then
    return new;
  end if;

  v_week_start := public.week_monday_istanbul(new.starts_at);

  for rec in
    select a.player_id
    from public.match_attendees a
    where a.match_id = new.id
      and a.status = 'going'::public.rsvp_status
  loop
    select p.weekly_match_last_qualifying_week_start, p.weekly_match_streak_weeks
    into v_last, v_streak
    from public.profiles p
    where p.id = rec.player_id
    for update;

    if v_week_start < coalesce(v_last, 'epoch'::date) then
      continue;
    end if;

    if v_last is null then
      update public.profiles
      set
        weekly_match_streak_weeks = 1,
        weekly_match_last_qualifying_week_start = v_week_start
      where id = rec.player_id;
    elsif v_week_start = v_last then
      continue;
    elsif v_week_start = v_last + 7 then
      update public.profiles
      set
        weekly_match_streak_weeks = v_streak + 1,
        weekly_match_last_qualifying_week_start = v_week_start
      where id = rec.player_id;
    else
      update public.profiles
      set
        weekly_match_streak_weeks = 1,
        weekly_match_last_qualifying_week_start = v_week_start
      where id = rec.player_id;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists matches_weekly_streak_on_finished on public.matches;

create trigger matches_weekly_streak_on_finished
after update on public.matches
for each row
execute procedure public.apply_weekly_match_streak_on_match_finished();

comment on function public.apply_weekly_match_streak_on_match_finished() is
  'Updates profiles weekly streak when a group match transitions to finished (going attendees).';

-- ---------------------------------------------------------------------------
-- 6) Enqueue streak-at-risk (Wednesday only; dedupe per token per reminder_date)
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_streak_at_risk_reminders(p_now timestamptz default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := coalesce(p_now, clock_timestamp());
  v_today date := (v_now at time zone 'Europe/Istanbul')::date;
  v_isodow int := extract(isodow from (v_now at time zone 'Europe/Istanbul'));
  v_week_monday date := public.week_monday_istanbul(v_now);
  v_prev_week_monday date := v_week_monday - 7;
  v_inserted int;
begin
  -- Wednesday only (ISO dow 1=Mon … 3=Wed); cron also fires weekly at 16:00 UTC = 19:00 Turkey.
  if v_isodow is distinct from 3 then
    return 0;
  end if;

  with candidates as (
    select distinct pr.id as player_id
    from public.profiles pr
    where pr.weekly_match_streak_weeks > 0
      and pr.weekly_match_last_qualifying_week_start is not null
      and pr.weekly_match_last_qualifying_week_start >= v_prev_week_monday
      and not exists (
        select 1
        from public.group_members gm
        join public.matches m on m.group_id = gm.group_id
        where gm.player_id = pr.id
          and m.status = 'upcoming'::public.match_status
          and public.week_monday_istanbul(m.starts_at) = v_week_monday
      )
      and not exists (
        select 1
        from public.match_attendees a
        join public.matches m on m.id = a.match_id
        where a.player_id = pr.id
          and a.status = 'going'::public.rsvp_status
          and m.group_id is not null
          and m.status = 'finished'::public.match_status
          and public.week_monday_istanbul(m.starts_at) = v_week_monday
      )
  ),
  ins as (
    insert into public.notification_deliveries
      (match_id, group_id, recipient_id, token, type, reminder_date)
    select
      null,
      null,
      pr.id,
      pt.token,
      'streak_at_risk',
      v_today
    from public.profiles pr
    join public.push_tokens pt on pt.user_id = pr.id and pt.is_active = true
    join candidates c on c.player_id = pr.id
    where public.notification_delivery_allowed(pr.notification_preferences, 'streak_at_risk')
    on conflict (recipient_id, token, reminder_date) where (type = 'streak_at_risk') do nothing
    returning 1
  )
  select count(*)::int into v_inserted from ins;

  return coalesce(v_inserted, 0);
end;
$$;

comment on function public.enqueue_streak_at_risk_reminders(timestamptz) is
  'Wednesday Istanbul: users with an active weekly streak but no upcoming match this week and no finished match this week — enqueue streak_at_risk. Optional p_now for tests.';

-- ---------------------------------------------------------------------------
-- 7) profiles_public: expose streak + effective count (stale weeks → 0)
-- ---------------------------------------------------------------------------

create or replace view public.profiles_public
with (security_invoker = false) as
select
  p.id,
  p.display_name,
  p.photo_uri,
  p.position,
  p.preferred_foot,
  p.weekly_match_streak_weeks,
  p.weekly_match_last_qualifying_week_start,
  case
    when p.weekly_match_streak_weeks <= 0
      or p.weekly_match_last_qualifying_week_start is null then 0
    when p.weekly_match_last_qualifying_week_start < (
      public.week_monday_istanbul(now()) - interval '7 days'
    )::date then 0
    else p.weekly_match_streak_weeks
  end as weekly_match_streak_effective_weeks
from public.profiles p;

comment on view public.profiles_public is
  'Non-sensitive profile fields + weekly match streak; security_invoker=false.';

-- ---------------------------------------------------------------------------
-- 8) Grants / revokes (enqueue is cron/service only)
-- ---------------------------------------------------------------------------

grant execute on function public.week_monday_istanbul(timestamptz) to anon, authenticated;

revoke execute on function public.enqueue_streak_at_risk_reminders(timestamptz) from public;
revoke execute on function public.enqueue_streak_at_risk_reminders(timestamptz) from anon;
revoke execute on function public.enqueue_streak_at_risk_reminders(timestamptz) from authenticated;

grant execute on function public.enqueue_streak_at_risk_reminders(timestamptz) to service_role;

revoke all on function public.apply_weekly_match_streak_on_match_finished() from public;
revoke all on function public.apply_weekly_match_streak_on_match_finished() from anon;
revoke all on function public.apply_weekly_match_streak_on_match_finished() from authenticated;

-- ---------------------------------------------------------------------------
-- 9) pg_cron: Wednesday 16:00 UTC == 19:00 Europe/Istanbul (TR fixed UTC+3)
-- ---------------------------------------------------------------------------

do $$
declare
  v_job record;
begin
  for v_job in
    select jobid
    from cron.job
    where jobname = 'weekly-match-streak-at-risk-enqueue'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end $$;

select cron.schedule(
  'weekly-match-streak-at-risk-enqueue',
  '0 16 * * 3',
  $$ select public.enqueue_streak_at_risk_reminders(null); $$
);
