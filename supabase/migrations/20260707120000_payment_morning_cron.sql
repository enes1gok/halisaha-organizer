-- Migration: Separate morning cron for payment_morning_reminder.
--
-- Before this migration, payment_morning_reminder was enqueued inside
-- enqueue_group_match_reminders() which runs at 16:00 UTC (19:00 Istanbul).
-- That means the "morning reminder" was actually sent in the evening.
--
-- This migration:
--   1. Creates enqueue_payment_morning_reminders() — handles only this type.
--   2. Schedules it at 07:00 UTC (10:00 Istanbul) daily.
--   3. Removes payment_morning_ins from enqueue_group_match_reminders() to
--      prevent duplicate late-evening inserts.

-- ── 1. enqueue_payment_morning_reminders ─────────────────────────────────────

create or replace function public.enqueue_payment_morning_reminders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Istanbul')::date;
  v_inserted int;
begin
  insert into public.notification_deliveries
    (match_id, group_id, recipient_id, token, type, reminder_date)
  select
    m.id,
    m.group_id,
    a.player_id,
    pt.token,
    'payment_morning_reminder',
    v_today
  from public.matches m
  join public.match_attendees a on a.match_id = m.id
  join public.push_tokens pt on pt.user_id = a.player_id and pt.is_active = true
  join public.profiles pr on pr.id = a.player_id
  where m.group_id is not null
    and m.starts_at::date = (now() at time zone 'Europe/Istanbul')::date
    and m.starts_at > now()
    and m.status = 'upcoming'::public.match_status
    and a.player_id <> m.organizer_id
    and a.status = 'going'::public.rsvp_status
    and a.paid = false
    and m.payment_method in ('cash'::public.match_payment_method, 'note_only'::public.match_payment_method)
    and public.notification_delivery_allowed(pr.notification_preferences, 'payment_morning_reminder')
  on conflict (match_id, recipient_id, token, reminder_date) where (type = 'payment_morning_reminder') do nothing;

  get diagnostics v_inserted = row_count;
  return coalesce(v_inserted, 0);
end;
$$;

comment on function public.enqueue_payment_morning_reminders() is
  'Enqueues morning payment reminders for cash/note matches happening today. Called by 07:00 UTC cron (10:00 Istanbul).';

-- ── 2. Grants ─────────────────────────────────────────────────────────────────

revoke execute on function public.enqueue_payment_morning_reminders() from public;
revoke execute on function public.enqueue_payment_morning_reminders() from anon;
revoke execute on function public.enqueue_payment_morning_reminders() from authenticated;
grant execute on function public.enqueue_payment_morning_reminders() to service_role;

-- ── 3. pg_cron: daily 07:00 UTC = 10:00 Europe/Istanbul ──────────────────────

do $$
declare
  v_job record;
begin
  for v_job in
    select jobid from cron.job where jobname = 'enqueue-payment-morning-reminders'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end $$;

select cron.schedule(
  'enqueue-payment-morning-reminders',
  '0 7 * * *',
  $$ select public.enqueue_payment_morning_reminders(); $$
);

-- ── 4. Remove payment_morning_ins from enqueue_group_match_reminders ──────────
-- The dedicated morning function now owns payment_morning_reminder.
-- The evening cron (16:00 UTC) no longer enqueues this type.

create or replace function public.enqueue_group_match_reminders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Istanbul')::date;
  v_inserted int;
begin
  with rsvp_ins as (
    insert into public.notification_deliveries
      (match_id, group_id, recipient_id, token, type, reminder_date)
    select
      m.id,
      m.group_id,
      gm.player_id,
      pt.token,
      'reminder',
      v_today
    from public.matches m
    join public.group_members gm on gm.group_id = m.group_id
    join public.push_tokens pt on pt.user_id = gm.player_id and pt.is_active = true
    join public.profiles pr on pr.id = gm.player_id
    left join public.match_attendees a
      on a.match_id = m.id and a.player_id = gm.player_id
    where m.group_id is not null
      and m.starts_at > now()
      and m.status = 'upcoming'::public.match_status
      and gm.player_id <> m.organizer_id
      and (a.status is null or a.status = 'maybe'::public.rsvp_status)
      and (
        select count(*) from public.match_attendees x
        where x.match_id = m.id and x.status = 'going'::public.rsvp_status
      ) < m.max_players
      and public.notification_delivery_allowed(pr.notification_preferences, 'reminder')
    on conflict (match_id, recipient_id, token, reminder_date) where (type = 'reminder') do nothing
    returning 1
  ),
  payment_ins as (
    insert into public.notification_deliveries
      (match_id, group_id, recipient_id, token, type, reminder_date)
    select
      m.id,
      m.group_id,
      a.player_id,
      pt.token,
      'payment_reminder',
      v_today
    from public.matches m
    join public.match_attendees a on a.match_id = m.id
    join public.push_tokens pt on pt.user_id = a.player_id and pt.is_active = true
    join public.profiles pr on pr.id = a.player_id
    where m.group_id is not null
      and m.starts_at > now()
      and m.starts_at <= now() + interval '24 hours'
      and m.status = 'upcoming'::public.match_status
      and a.player_id <> m.organizer_id
      and a.status = 'going'::public.rsvp_status
      and a.paid = false
      and m.payment_method = 'iban'::public.match_payment_method
      and public.notification_delivery_allowed(pr.notification_preferences, 'payment_reminder')
    on conflict (match_id, recipient_id, token, reminder_date) where (type = 'payment_reminder') do nothing
    returning 1
  ),
  payment_summary_org_ins as (
    insert into public.notification_deliveries
      (match_id, group_id, recipient_id, token, type, reminder_date)
    select distinct on (m.id, pt.token)
      m.id,
      m.group_id,
      m.organizer_id,
      pt.token,
      'payment_unpaid_summary_organizer',
      v_today
    from public.matches m
    join public.match_attendees a
      on a.match_id = m.id and a.paid = false and a.status = 'going'::public.rsvp_status
    join public.push_tokens pt on pt.user_id = m.organizer_id and pt.is_active = true
    join public.profiles pr on pr.id = m.organizer_id
    where m.group_id is not null
      and m.starts_at > now() + interval '36 hours'
      and m.starts_at <= now() + interval '48 hours'
      and m.status = 'upcoming'::public.match_status
      and m.payment_method = 'iban'::public.match_payment_method
      and public.notification_delivery_allowed(pr.notification_preferences, 'payment_unpaid_summary_organizer')
    on conflict (match_id, recipient_id, reminder_date) where (type = 'payment_unpaid_summary_organizer') do nothing
    returning 1
  )
  select coalesce((select count(*) from rsvp_ins), 0)
    + coalesce((select count(*) from payment_ins), 0)
    + coalesce((select count(*) from payment_summary_org_ins), 0)
  into v_inserted;

  return coalesce(v_inserted, 0);
end;
$$;

comment on function public.enqueue_group_match_reminders() is
  'Enqueues RSVP reminders, IBAN payment reminders (daily 16:00 UTC), and 2-day-out organizer unpaid summary. Cash/note morning reminders handled by enqueue_payment_morning_reminders (07:00 UTC cron).';
