-- Match cancellation + venue change push deliveries.
-- Adds match_status 'cancelled', extends notification_deliveries types, preference keys,
-- and AFTER UPDATE triggers on public.matches.
--
-- Existing timing (unchanged): group-match-deliveries-drain runs every minute (* * * * *)
--   so pending rows are typically sent within ~1 minute when app.edge_function_url /
--   app.edge_service_key are set. Daily RSVP reminders enqueue at 16:00 UTC (= 19:00 TR).

-- ---------------------------------------------------------------------------
-- 1) Enum: cancelled matches (trigger + app agree on status value)
-- ---------------------------------------------------------------------------

do $$
begin
  alter type public.match_status add value 'cancelled';
exception
  when duplicate_object then
    null;
end $$;

-- ---------------------------------------------------------------------------
-- 2) notification_deliveries: types + reminder_date rule + dedup index
-- ---------------------------------------------------------------------------

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_type_check;

alter table public.notification_deliveries
  add constraint notification_deliveries_type_check
  check (type in ('initial', 'reminder', 'match_cancelled', 'venue_change'));

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_reminder_date_chk;

alter table public.notification_deliveries
  add constraint notification_deliveries_reminder_date_chk check (
    (type in ('initial', 'match_cancelled', 'venue_change') and reminder_date is null)
    or (type = 'reminder' and reminder_date is not null)
  );

create unique index if not exists notification_deliveries_unique_match_cancelled
  on public.notification_deliveries (match_id, recipient_id, token)
  where type = 'match_cancelled';

comment on column public.profiles.notification_preferences is
  'JSON: push_enabled, types.group_match_initial|group_match_reminder|group_match_cancelled|group_match_venue_change, quiet_hours. Omitted keys default to enabled.';

-- ---------------------------------------------------------------------------
-- 3) Preference gate for new enqueue paths
-- ---------------------------------------------------------------------------

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
    else true
  end;
$$;

comment on function public.notification_delivery_allowed(jsonb, text) is
  'Whether enqueue should create a delivery for this prefs blob and delivery type (initial|reminder|match_cancelled|venue_change).';

-- ---------------------------------------------------------------------------
-- 4) Cancel: purge pending deliveries + enqueue match_cancelled (same audience as initial)
-- ---------------------------------------------------------------------------

create or replace function public.handle_match_status_cancelled_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.group_id is null then
    return new;
  end if;

  if new.status = 'cancelled'::public.match_status
     and old.status is distinct from 'cancelled'::public.match_status then

    delete from public.notification_deliveries
    where match_id = new.id
      and status = 'pending';

    insert into public.notification_deliveries
      (match_id, group_id, recipient_id, token, type)
    select
      new.id,
      new.group_id,
      gm.player_id,
      pt.token,
      'match_cancelled'
    from public.group_members gm
    join public.push_tokens pt on pt.user_id = gm.player_id
    join public.profiles pr on pr.id = gm.player_id
    where gm.group_id = new.group_id
      and gm.player_id <> new.organizer_id
      and pt.is_active = true
      and public.notification_delivery_allowed(pr.notification_preferences, 'match_cancelled')
    on conflict (match_id, recipient_id, token) where (type = 'match_cancelled') do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists matches_handle_cancelled_notifications on public.matches;

create trigger matches_handle_cancelled_notifications
after update of status on public.matches
for each row
execute procedure public.handle_match_status_cancelled_notifications();

-- ---------------------------------------------------------------------------
-- 5) Venue change: going attendees only (organizer excluded; skip when match cancelled)
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_group_match_venue_change_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.group_id is null then
    return new;
  end if;

  if new.status = 'cancelled'::public.match_status then
    return new;
  end if;

  if new.venue is not distinct from old.venue then
    return new;
  end if;

  insert into public.notification_deliveries
    (match_id, group_id, recipient_id, token, type)
  select
    new.id,
    new.group_id,
    a.player_id,
    pt.token,
    'venue_change'
  from public.match_attendees a
  join public.push_tokens pt on pt.user_id = a.player_id and pt.is_active = true
  join public.profiles pr on pr.id = a.player_id
  where a.match_id = new.id
    and a.status = 'going'::public.rsvp_status
    and a.player_id <> new.organizer_id
    and public.notification_delivery_allowed(pr.notification_preferences, 'venue_change');

  return new;
end;
$$;

drop trigger if exists matches_enqueue_venue_change_notifications on public.matches;

create trigger matches_enqueue_venue_change_notifications
after update of venue on public.matches
for each row
execute procedure public.enqueue_group_match_venue_change_notifications();

-- ---------------------------------------------------------------------------
-- 6) Grants (security linter: no accidental PUBLIC execute on SD helpers)
-- ---------------------------------------------------------------------------

revoke execute on function public.handle_match_status_cancelled_notifications() from public;
revoke execute on function public.enqueue_group_match_venue_change_notifications() from public;

grant execute on function public.handle_match_status_cancelled_notifications() to authenticated;
grant execute on function public.enqueue_group_match_venue_change_notifications() to authenticated;

revoke execute on function public.handle_match_status_cancelled_notifications() from anon;
revoke execute on function public.enqueue_group_match_venue_change_notifications() from anon;
