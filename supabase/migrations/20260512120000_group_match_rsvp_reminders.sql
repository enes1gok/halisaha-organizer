-- Group match RSVP-aware reminder pipeline.
-- Builds on top of 20260507194000_groups_push_notifications.sql.
--
-- Adds:
--   * notification_deliveries.{type, reminder_date, claimed_at}
--   * 'sending' status (atomic claim) + integrity check on (type ⇄ reminder_date)
--   * Partial unique indexes for 'initial' (per match/recipient/token) and 'reminder' (per match/recipient/token/date)
--   * enqueue_group_match_reminders(): inserts a daily reminder row for each
--     group member whose RSVP is 'maybe' or absent, while the match is still
--     upcoming and not full.
--   * cancel_pending_reminders_on_rsvp(): drops queued reminders the moment a
--     user explicitly chooses 'going' / 'not_going'.
--   * claim_pending_deliveries(): atomic batch claim (FOR UPDATE SKIP LOCKED)
--     with stuck-claim recovery, used by the Edge Function in drain mode.
--   * drain_notification_deliveries(): pg_net hop into the Edge Function;
--     per-minute pg_cron job. Daily 16:00 UTC (= 19:00 Europe/Istanbul) cron
--     job calls enqueue_group_match_reminders().
--
-- Operator step (per environment, after deploy):
--   alter database postgres set app.edge_function_url =
--     'https://<project-ref>.supabase.co/functions/v1/group-match-created';
--   alter database postgres set app.edge_service_key = '<service-role-key>';
-- The drain cron is a no-op until both GUCs are set.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- 1) Schema extension on notification_deliveries
-- ---------------------------------------------------------------------------

alter table public.notification_deliveries
  add column if not exists type text not null default 'initial';

alter table public.notification_deliveries
  add column if not exists reminder_date date;

alter table public.notification_deliveries
  add column if not exists claimed_at timestamptz;

-- 'sending' = row claimed by a drain worker; transitions to 'sent' or 'failed'.
do $$
declare
  v_conname text;
begin
  for v_conname in
    select conname
    from pg_constraint
    where conrelid = 'public.notification_deliveries'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%pending%sent%failed%'
  loop
    execute format('alter table public.notification_deliveries drop constraint %I', v_conname);
  end loop;
end $$;

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_status_check;

alter table public.notification_deliveries
  add constraint notification_deliveries_status_check
  check (status in ('pending', 'sending', 'sent', 'failed'));

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_type_check;

alter table public.notification_deliveries
  add constraint notification_deliveries_type_check
  check (type in ('initial', 'reminder'));

-- 'reminder' rows MUST carry a date (one per day per recipient/token);
-- 'initial' rows MUST NOT (single broadcast per match).
alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_reminder_date_chk;

alter table public.notification_deliveries
  add constraint notification_deliveries_reminder_date_chk check (
    (type = 'initial' and reminder_date is null)
    or (type = 'reminder' and reminder_date is not null)
  );

-- ---------------------------------------------------------------------------
-- 2) Replace single unique index with two partial ones
-- ---------------------------------------------------------------------------

drop index if exists public.notification_deliveries_unique_target;

create unique index if not exists notification_deliveries_unique_initial
  on public.notification_deliveries (match_id, recipient_id, token)
  where type = 'initial';

create unique index if not exists notification_deliveries_unique_reminder
  on public.notification_deliveries (match_id, recipient_id, token, reminder_date)
  where type = 'reminder';

create index if not exists notification_deliveries_status_pending_idx
  on public.notification_deliveries (status, created_at)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- 3) Initial-broadcast trigger: tag rows as 'initial'
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
  where gm.group_id = new.group_id
    and gm.player_id <> new.organizer_id
    and pt.is_active = true
  on conflict (match_id, recipient_id, token) where (type = 'initial') do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Daily reminder enqueue
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
    on conflict (match_id, recipient_id, token, reminder_date) where (type = 'reminder') do nothing
    returning 1
  )
  select count(*) into v_inserted from ins;
  return coalesce(v_inserted, 0);
end;
$$;

grant execute on function public.enqueue_group_match_reminders() to service_role;

-- ---------------------------------------------------------------------------
-- 5) RSVP-driven reminder cancellation
-- ---------------------------------------------------------------------------

create or replace function public.cancel_pending_reminders_on_rsvp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('going'::public.rsvp_status, 'not_going'::public.rsvp_status) then
    delete from public.notification_deliveries
    where match_id = new.match_id
      and recipient_id = new.player_id
      and type = 'reminder'
      and status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists match_attendees_cancel_reminder on public.match_attendees;

create trigger match_attendees_cancel_reminder
after insert or update of status on public.match_attendees
for each row execute procedure public.cancel_pending_reminders_on_rsvp();

-- ---------------------------------------------------------------------------
-- 6) Atomic batch claim for the drain worker
--    Uses FOR UPDATE SKIP LOCKED so concurrent drains never observe each
--    other's rows. A row stuck in 'sending' for >5 min is reset and retried.
-- ---------------------------------------------------------------------------

create or replace function public.claim_pending_deliveries(p_limit int default 50)
returns table (
  delivery_id uuid,
  delivery_token text,
  match_id uuid,
  group_id uuid,
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

-- ---------------------------------------------------------------------------
-- 7) Drain helper (pg_net → Edge Function). No-op until GUCs are configured.
-- ---------------------------------------------------------------------------

create or replace function public.drain_notification_deliveries()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text := current_setting('app.edge_function_url', true);
  v_key text := current_setting('app.edge_service_key', true);
begin
  if v_url is null or btrim(v_url) = '' then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || coalesce(v_key, ''),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('mode', 'drain')
  );
end;
$$;

grant execute on function public.drain_notification_deliveries() to service_role;

-- ---------------------------------------------------------------------------
-- 8) Schedule pg_cron jobs (idempotent: unschedule existing jobs first).
-- ---------------------------------------------------------------------------

do $$
declare
  v_job record;
begin
  for v_job in
    select jobid
    from cron.job
    where jobname in ('group-match-reminders-enqueue', 'group-match-deliveries-drain')
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end $$;

-- 16:00 UTC == 19:00 Europe/Istanbul (TR is fixed UTC+3, no DST).
select cron.schedule(
  'group-match-reminders-enqueue',
  '0 16 * * *',
  $$ select public.enqueue_group_match_reminders(); $$
);

select cron.schedule(
  'group-match-deliveries-drain',
  '* * * * *',
  $$ select public.drain_notification_deliveries(); $$
);
