-- Payment reminder push deliveries.
-- Adds delivery type `payment_reminder` and enqueues reminders for unpaid
-- attendees when match start time is within next 24 hours.

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
      'payment_reminder'
    )
  );

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_reminder_date_chk;

alter table public.notification_deliveries
  add constraint notification_deliveries_reminder_date_chk check (
    (
      type in ('initial', 'match_cancelled', 'venue_change', 'lineup_published')
      and reminder_date is null
    )
    or (type in ('reminder', 'payment_reminder') and reminder_date is not null)
  );

create unique index if not exists notification_deliveries_unique_payment_reminder
  on public.notification_deliveries (match_id, recipient_id, token, reminder_date)
  where type = 'payment_reminder';

comment on column public.profiles.notification_preferences is
  'JSON: push_enabled, types.group_match_initial|group_match_reminder|group_match_cancelled|group_match_venue_change|group_match_lineup_published|group_match_payment_reminder, quiet_hours. Omitted keys default to enabled.';

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
    else true
  end;
$$;

comment on function public.notification_delivery_allowed(jsonb, text) is
  'Whether enqueue should create a delivery for this prefs blob and delivery type (initial|reminder|match_cancelled|venue_change|lineup_published|payment_reminder).';

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
      and public.notification_delivery_allowed(pr.notification_preferences, 'payment_reminder')
    on conflict (match_id, recipient_id, token, reminder_date) where (type = 'payment_reminder') do nothing
    returning 1
  )
  select coalesce((select count(*) from rsvp_ins), 0)
    + coalesce((select count(*) from payment_ins), 0)
  into v_inserted;

  return coalesce(v_inserted, 0);
end;
$$;
