-- Migration: Payment reminder expansion.
--
-- Adds two new delivery types:
--   payment_morning_reminder  — maç günü sabahı nakit/not ödeme hatırlatması
--   payment_unpaid_summary_organizer — maçtan 2 gün önce IBAN borçlu özeti (organizatöre)

-- ── 0. public.match_payment_method type ──────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'match_payment_method') then
    create type public.match_payment_method as enum ('note_only', 'iban', 'cash');
  end if;
end $$;

alter table public.matches
  drop constraint if exists matches_payment_method_chk,
  drop constraint if exists matches_payment_note_chk;

alter table public.matches
  alter column payment_method drop default,
  alter column payment_method type public.match_payment_method using payment_method::public.match_payment_method,
  alter column payment_method set default 'iban'::public.match_payment_method;

alter table public.matches
  add constraint matches_payment_note_chk
  check (
    (
      payment_method = 'note_only'::public.match_payment_method
      and char_length(trim(coalesce(payment_note, ''))) between 1 and 120
      and iban is null
      and iban_account_name is null
    )
    or
    (
      payment_method <> 'note_only'::public.match_payment_method
      and payment_note is null
    )
  );

-- ── 1. notification_deliveries_type_check ────────────────────────────────────

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
      'streak_at_risk',
      'payment_morning_reminder',
      'payment_unpaid_summary_organizer'
    )
  );

-- ── 2. reminder_date chk — yeni type'lar için not null ───────────────────────

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_reminder_date_chk;

alter table public.notification_deliveries
  add constraint notification_deliveries_reminder_date_chk check (
    (
      type in (
        'initial', 'match_cancelled', 'venue_change', 'lineup_published',
        'match_result'
      )
      and reminder_date is null
    )
    or (
      type in (
        'reminder', 'payment_reminder', 'post_match_rating_reminder',
        'streak_at_risk', 'payment_morning_reminder',
        'payment_unpaid_summary_organizer'
      )
      and reminder_date is not null
    )
  );

-- ── 3. Unique indexes ─────────────────────────────────────────────────────────

create unique index if not exists notification_deliveries_unique_payment_morning
  on public.notification_deliveries (match_id, recipient_id, token, reminder_date)
  where type = 'payment_morning_reminder';

create unique index if not exists notification_deliveries_unique_payment_summary_org
  on public.notification_deliveries (match_id, recipient_id, reminder_date)
  where type = 'payment_unpaid_summary_organizer';

-- ── 4. notification_delivery_allowed ─────────────────────────────────────────

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
      p_prefs->'types'->'group_match_initial', true)
    when p_delivery_type = 'reminder' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_reminder', true)
    when p_delivery_type = 'match_cancelled' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_cancelled', true)
    when p_delivery_type = 'venue_change' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_venue_change', true)
    when p_delivery_type = 'lineup_published' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_lineup_published', true)
    when p_delivery_type = 'payment_reminder' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_payment_reminder', true)
    when p_delivery_type = 'payment_morning_reminder' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_payment_morning_reminder', true)
    when p_delivery_type = 'payment_unpaid_summary_organizer' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_payment_unpaid_summary_organizer', true)
    when p_delivery_type = 'post_match_rating_reminder' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_post_match_rating_reminder', true)
    when p_delivery_type = 'match_result' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_match_result', true)
    when p_delivery_type = 'streak_at_risk' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_streak_at_risk', true)
    else true
  end;
$$;

comment on function public.notification_delivery_allowed(jsonb, text) is
  'Whether enqueue should create a delivery for this prefs blob and delivery type.';

-- ── 5. enqueue_group_match_reminders ─────────────────────────────────────────

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
  -- Nakit/not maçlar için sabah bildirimi (maç günü, ödemesiz going katılımcılar)
  payment_morning_ins as (
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
      and m.status = 'upcoming'::public.match_status
      and a.player_id <> m.organizer_id
      and a.status = 'going'::public.rsvp_status
      and a.paid = false
      and m.payment_method in ('cash'::public.match_payment_method, 'note_only'::public.match_payment_method)
      and public.notification_delivery_allowed(pr.notification_preferences, 'payment_morning_reminder')
    on conflict (match_id, recipient_id, token, reminder_date) where (type = 'payment_morning_reminder') do nothing
    returning 1
  ),
  -- Organizatöre IBAN borçlu özeti (maçtan 36-48 saat önce, sadece IBAN maçlar)
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
    join public.match_attendees a on a.match_id = m.id and a.paid = false and a.status = 'going'::public.rsvp_status
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
    + coalesce((select count(*) from payment_morning_ins), 0)
    + coalesce((select count(*) from payment_summary_org_ins), 0)
  into v_inserted;

  return coalesce(v_inserted, 0);
end;
$$;

comment on function public.enqueue_group_match_reminders() is
  'Enqueues RSVP reminders, IBAN payment reminders (daily), nakit/not morning reminders, and 2-day-out organizer unpaid summary.';
