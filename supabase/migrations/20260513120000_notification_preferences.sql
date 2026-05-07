-- Per-user notification preferences on profiles (jsonb).
-- Used by group match push enqueue + Edge Function (types + quiet hours).

alter table public.profiles
  add column if not exists notification_preferences jsonb not null default '{}'::jsonb;

comment on column public.profiles.notification_preferences is
  'JSON: push_enabled, types.group_match_initial, types.group_match_reminder, quiet_hours { enabled, start, end, timezone }. Omitted keys default to enabled.';

-- Stable helpers: missing / JSON null = default (backward compatible).
create or replace function public.coalesce_notification_pref_bool(
  p_val jsonb,
  p_default boolean
) returns boolean
language sql
immutable
as $$
  select case
    when p_val is null or jsonb_typeof(p_val) = 'null' then p_default
    when jsonb_typeof(p_val) = 'boolean' then p_val = 'true'::jsonb
    else p_default
  end;
$$;

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
    else true
  end;
$$;

comment on function public.notification_delivery_allowed(jsonb, text) is
  'Whether enqueue should create a delivery for this prefs blob and delivery type (initial|reminder).';

-- ---------------------------------------------------------------------------
-- Initial broadcast: respect preferences
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_group_match_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.group_id is null then
    return new;
  end if;

  insert into public.notification_deliveries
    (match_id, group_id, recipient_id, token, type)
  select
    new.id,
    new.group_id,
    gm.player_id,
    pt.token,
    'initial'
  from public.group_members gm
  join public.push_tokens pt on pt.user_id = gm.player_id
  join public.profiles pr on pr.id = gm.player_id
  where gm.group_id = new.group_id
    and gm.player_id <> new.organizer_id
    and pt.is_active = true
    and public.notification_delivery_allowed(pr.notification_preferences, 'initial')
  on conflict (match_id, recipient_id, token) where (type = 'initial') do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Daily reminder enqueue: respect preferences
-- ---------------------------------------------------------------------------

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
  with ins as (
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
  )
  select count(*) into v_inserted from ins;
  return coalesce(v_inserted, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Claim: include recipient_id for Edge preference / quiet-hour checks
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
  group_name text
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
    g.name
  from claimed c
  left join public.matches m on m.id = c.match_id
  left join public.groups g on g.id = c.group_id;
end;
$$;

grant execute on function public.claim_pending_deliveries(int) to service_role;
