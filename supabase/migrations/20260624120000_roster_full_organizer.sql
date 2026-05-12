-- Migration: Roster full organizer notification + late-join guard.
--
-- ERR tokens added: ERR_MATCH_ROSTER_FULL
--
-- Changes:
--   1. notification_deliveries_type_check — adds 'roster_full_organizer'.
--   2. BEFORE UPDATE trigger on match_attendees — blocks going when roster full (ERR_MATCH_ROSTER_FULL).
--   3. AFTER INSERT/UPDATE trigger on match_attendees — enqueues 'roster_full_organizer' to organizer.

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
      'payment_unpaid_summary_organizer',
      'roster_full_organizer'
    )
  );

-- ── 2. Unique index ───────────────────────────────────────────────────────────

create unique index if not exists notification_deliveries_unique_roster_full_organizer
  on public.notification_deliveries (match_id, recipient_id, token)
  where type = 'roster_full_organizer';

-- ── 3. BEFORE trigger — late-join guard ──────────────────────────────────────

create or replace function public.enforce_match_roster_not_full()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
  v_going int;
begin
  -- Sadece status 'going' olarak değiştiriliyorsa kontrol et
  if new.status <> 'going'::public.rsvp_status then
    return new;
  end if;

  -- Zaten 'going' ise (status aynı kalıyorsa) geç
  if old.status = 'going'::public.rsvp_status then
    return new;
  end if;

  select m.max_players into v_max
  from public.matches m
  where m.id = new.match_id;

  if v_max is null then
    return new;
  end if;

  select count(*) into v_going
  from public.match_attendees
  where match_id = new.match_id
    and status = 'going'::public.rsvp_status
    and player_id <> new.player_id;

  if v_going >= v_max then
    perform public.raise_app_error('ERR_MATCH_ROSTER_FULL');
  end if;

  return new;
end;
$$;

drop trigger if exists match_attendees_enforce_roster_not_full on public.match_attendees;

create trigger match_attendees_enforce_roster_not_full
  before insert or update of status
  on public.match_attendees
  for each row
  execute procedure public.enforce_match_roster_not_full();

-- ── 4. AFTER trigger — roster_full_organizer enqueue ─────────────────────────

create or replace function public.enqueue_roster_full_organizer_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match record;
  v_going int;
begin
  -- Sadece status 'going' olduğunda tetikle
  if new.status <> 'going'::public.rsvp_status then
    return new;
  end if;

  select m.*
  into v_match
  from public.matches m
  where m.id = new.match_id;

  -- Sadece grup maçları + upcoming
  if v_match.group_id is null or v_match.status <> 'upcoming'::public.match_status then
    return new;
  end if;

  select count(*) into v_going
  from public.match_attendees
  where match_id = v_match.id
    and status = 'going'::public.rsvp_status;

  if v_going <> v_match.max_players then
    return new;
  end if;

  insert into public.notification_deliveries
    (match_id, group_id, recipient_id, token, type)
  select
    v_match.id,
    v_match.group_id,
    v_match.organizer_id,
    pt.token,
    'roster_full_organizer'
  from public.push_tokens pt
  join public.profiles pr on pr.id = pt.user_id
  where pt.user_id = v_match.organizer_id
    and pt.is_active = true
    and public.notification_delivery_allowed(pr.notification_preferences, 'roster_full_organizer')
  on conflict (match_id, recipient_id, token)
    where (type = 'roster_full_organizer') do nothing;

  return new;
end;
$$;

drop trigger if exists match_attendees_roster_full_notify on public.match_attendees;

create trigger match_attendees_roster_full_notify
  after insert or update of status
  on public.match_attendees
  for each row
  execute procedure public.enqueue_roster_full_organizer_notification();
