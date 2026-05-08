-- Lineup published push: when organizer locks lineup on a group match, enqueue
-- lineup_published for going attendees (organizer excluded). Drain pipeline unchanged.

-- ---------------------------------------------------------------------------
-- 1) notification_deliveries: type + reminder_date + dedup index
-- ---------------------------------------------------------------------------

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
      'lineup_published'
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
    or (type = 'reminder' and reminder_date is not null)
  );

create unique index if not exists notification_deliveries_unique_lineup_published
  on public.notification_deliveries (match_id, recipient_id, token)
  where type = 'lineup_published';

comment on column public.profiles.notification_preferences is
  'JSON: push_enabled, types.group_match_initial|group_match_reminder|group_match_cancelled|group_match_venue_change|group_match_lineup_published, quiet_hours. Omitted keys default to enabled.';

-- ---------------------------------------------------------------------------
-- 2) Preference gate
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
    when p_delivery_type = 'lineup_published' then public.coalesce_notification_pref_bool(
      p_prefs->'types'->'group_match_lineup_published',
      true
    )
    else true
  end;
$$;

comment on function public.notification_delivery_allowed(jsonb, text) is
  'Whether enqueue should create a delivery for this prefs blob and delivery type (initial|reminder|match_cancelled|venue_change|lineup_published).';

-- ---------------------------------------------------------------------------
-- 3) Trigger: lineup_locked false -> true
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_lineup_published_notifications()
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

  if coalesce(old.lineup_locked, false) then
    return new;
  end if;

  if not coalesce(new.lineup_locked, false) then
    return new;
  end if;

  insert into public.notification_deliveries
    (match_id, group_id, recipient_id, token, type)
  select
    new.id,
    new.group_id,
    a.player_id,
    pt.token,
    'lineup_published'
  from public.match_attendees a
  join public.push_tokens pt on pt.user_id = a.player_id and pt.is_active = true
  join public.profiles pr on pr.id = a.player_id
  where a.match_id = new.id
    and a.status = 'going'::public.rsvp_status
    and a.player_id <> new.organizer_id
    and public.notification_delivery_allowed(pr.notification_preferences, 'lineup_published')
  on conflict (match_id, recipient_id, token) where (type = 'lineup_published') do nothing;

  return new;
end;
$$;

drop trigger if exists matches_enqueue_lineup_published_notifications on public.matches;

create trigger matches_enqueue_lineup_published_notifications
after update of lineup_locked on public.matches
for each row
execute procedure public.enqueue_lineup_published_notifications();

-- ---------------------------------------------------------------------------
-- 4) claim_pending_deliveries: organizer display name for Edge copy
-- ---------------------------------------------------------------------------

drop function if exists public.claim_pending_deliveries(int);

create or replace function public.claim_pending_deliveries(p_limit int default 50)
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
      order by inner_nd.created_at
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
    org.display_name
  from claimed c
  left join public.matches m on m.id = c.match_id
  left join public.groups g on g.id = c.group_id
  left join public.profiles org on org.id = m.organizer_id;
end;
$$;

grant execute on function public.claim_pending_deliveries(integer) to service_role;

revoke execute on function public.claim_pending_deliveries(integer) from public;
revoke execute on function public.claim_pending_deliveries(integer) from anon;

-- ---------------------------------------------------------------------------
-- 5) Grants (enqueue helper: same pattern as venue_change trigger)
-- ---------------------------------------------------------------------------

revoke execute on function public.enqueue_lineup_published_notifications() from public;

grant execute on function public.enqueue_lineup_published_notifications() to authenticated;

revoke execute on function public.enqueue_lineup_published_notifications() from anon;
