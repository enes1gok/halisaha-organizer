-- JSONB notification preference baseline / regression checks.
-- Run in Supabase SQL Editor or psql against local/staging data.
-- Do not use `supabase db query --file` for the whole file: the CLI sends the
-- file as one prepared statement and rejects multi-statement scripts.
--
-- Replace the UUID placeholders in each params CTE with representative rows.
-- Use EXPLAIN (ANALYZE, BUFFERS) on non-production data, or during a safe
-- maintenance window, because ANALYZE executes the statement.

-- ---------------------------------------------------------------------------
-- 1) JSONB/index inventory
-- ---------------------------------------------------------------------------

select
  n.nspname as schema_name,
  c.relname as table_name,
  a.attname as column_name,
  pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type
from pg_attribute a
join pg_class c on c.oid = a.attrelid
join pg_namespace n on n.oid = c.relnamespace
where a.attnum > 0
  and not a.attisdropped
  and pg_catalog.format_type(a.atttypid, a.atttypmod) in ('json', 'jsonb')
  and n.nspname in ('public', 'audit')
order by n.nspname, c.relname, a.attname;

select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname in ('public', 'audit')
  and (
    indexdef ilike '% using gin %'
    or indexdef ilike '%notification_preferences%'
    or indexdef ilike '%jsonb%'
  )
order by schemaname, tablename, indexname;

-- ---------------------------------------------------------------------------
-- 2) Table/index health for notification enqueue paths
-- ---------------------------------------------------------------------------

select
  relname,
  n_live_tup as est_live_rows,
  n_dead_tup as est_dead_rows,
  seq_scan,
  idx_scan,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
from pg_stat_user_tables
where schemaname = 'public'
  and relname in (
    'profiles',
    'groups',
    'group_members',
    'push_tokens',
    'matches',
    'match_attendees',
    'notification_deliveries'
  )
order by relname;

select
  tablename,
  pg_size_pretty(pg_total_relation_size(format('%I.%I', schemaname, tablename)::regclass)) as total_size
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles',
    'group_members',
    'push_tokens',
    'matches',
    'match_attendees',
    'notification_deliveries'
  )
order by tablename;

select
  status,
  type,
  count(*) as rows
from public.notification_deliveries
group by status, type
order by rows desc;

-- Preference shape distribution. This helps estimate whether opt-outs are rare
-- and whether partial indexes would be selective if the model changes later.
select
  count(*) as profile_rows,
  count(*) filter (
    where public.coalesce_notification_pref_bool(notification_preferences->'push_enabled', true) = false
  ) as push_disabled,
  count(*) filter (
    where public.coalesce_notification_pref_bool(
      notification_preferences->'types'->'group_match_initial',
      true
    ) = false
  ) as initial_disabled,
  count(*) filter (
    where public.coalesce_notification_pref_bool(
      notification_preferences->'types'->'group_match_reminder',
      true
    ) = false
  ) as reminder_disabled,
  count(*) filter (
    where public.coalesce_notification_pref_bool(
      notification_preferences->'types'->'group_match_streak_at_risk',
      true
    ) = false
  ) as streak_at_risk_disabled
from public.profiles;

-- ---------------------------------------------------------------------------
-- 3) Initial group match broadcast candidate shape
-- ---------------------------------------------------------------------------

explain (analyze, buffers, verbose)
with params as (
  select
    '00000000-0000-0000-0000-000000000001'::uuid as match_id,
    '00000000-0000-0000-0000-000000000002'::uuid as group_id,
    '00000000-0000-0000-0000-000000000003'::uuid as organizer_id
)
select
  p.match_id,
  p.group_id,
  gm.player_id,
  pt.token,
  public.notification_delivery_allowed(pr.notification_preferences, 'initial') as allowed
from params p
join public.group_members gm on gm.group_id = p.group_id
join public.push_tokens pt on pt.user_id = gm.player_id
join public.profiles pr on pr.id = gm.player_id
where gm.player_id <> p.organizer_id
  and pt.is_active = true
  and public.notification_delivery_allowed(pr.notification_preferences, 'initial');

-- Optional conflict-path check. This writes inside a transaction and rolls back.
-- Replace params first, then uncomment as needed.
--
-- begin;
-- explain (analyze, buffers, verbose)
-- with params as (
--   select
--     '00000000-0000-0000-0000-000000000001'::uuid as match_id,
--     '00000000-0000-0000-0000-000000000002'::uuid as group_id,
--     '00000000-0000-0000-0000-000000000003'::uuid as organizer_id
-- )
-- insert into public.notification_deliveries (match_id, group_id, recipient_id, token, type)
-- select
--   p.match_id,
--   p.group_id,
--   gm.player_id,
--   pt.token,
--   'initial'
-- from params p
-- join public.group_members gm on gm.group_id = p.group_id
-- join public.push_tokens pt on pt.user_id = gm.player_id
-- join public.profiles pr on pr.id = gm.player_id
-- where gm.player_id <> p.organizer_id
--   and pt.is_active = true
--   and public.notification_delivery_allowed(pr.notification_preferences, 'initial')
-- on conflict (match_id, recipient_id, token) where (type = 'initial') do nothing;
-- rollback;

-- ---------------------------------------------------------------------------
-- 4) Reminder candidate shape
-- ---------------------------------------------------------------------------

explain (analyze, buffers, verbose)
select
  m.id as match_id,
  m.group_id,
  gm.player_id,
  pt.token,
  public.notification_delivery_allowed(pr.notification_preferences, 'reminder') as allowed
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
    select count(*)
    from public.match_attendees x
    where x.match_id = m.id
      and x.status = 'going'::public.rsvp_status
  ) < m.max_players
  and public.notification_delivery_allowed(pr.notification_preferences, 'reminder');

-- ---------------------------------------------------------------------------
-- 5) Attendee-based delivery shapes
-- ---------------------------------------------------------------------------

-- Venue change: going attendees only.
explain (analyze, buffers, verbose)
with params as (
  select '00000000-0000-0000-0000-000000000001'::uuid as match_id
)
select
  a.match_id,
  m.group_id,
  a.player_id,
  pt.token,
  public.notification_delivery_allowed(pr.notification_preferences, 'venue_change') as allowed
from params p
join public.matches m on m.id = p.match_id
join public.match_attendees a on a.match_id = m.id
join public.push_tokens pt on pt.user_id = a.player_id and pt.is_active = true
join public.profiles pr on pr.id = a.player_id
where a.status = 'going'::public.rsvp_status
  and a.player_id <> m.organizer_id
  and public.notification_delivery_allowed(pr.notification_preferences, 'venue_change');

-- Cancellation: latest migration narrows this to going attendees only.
explain (analyze, buffers, verbose)
with params as (
  select '00000000-0000-0000-0000-000000000001'::uuid as match_id
)
select
  a.match_id,
  m.group_id,
  a.player_id,
  pt.token,
  public.notification_delivery_allowed(pr.notification_preferences, 'match_cancelled') as allowed
from params p
join public.matches m on m.id = p.match_id
join public.match_attendees a on a.match_id = m.id
join public.push_tokens pt on pt.user_id = a.player_id and pt.is_active = true
join public.profiles pr on pr.id = a.player_id
where a.status = 'going'::public.rsvp_status
  and a.player_id <> m.organizer_id
  and public.notification_delivery_allowed(pr.notification_preferences, 'match_cancelled');

explain (analyze, buffers, verbose)
with params as (
  select '00000000-0000-0000-0000-000000000001'::uuid as match_id
)
select
  a.match_id,
  m.group_id,
  a.player_id,
  pt.token,
  public.notification_delivery_allowed(pr.notification_preferences, 'lineup_published') as allowed
from params p
join public.matches m on m.id = p.match_id
join public.match_attendees a on a.match_id = m.id
join public.push_tokens pt on pt.user_id = a.player_id and pt.is_active = true
join public.profiles pr on pr.id = a.player_id
where a.status = 'going'::public.rsvp_status
  and a.player_id <> m.organizer_id
  and public.notification_delivery_allowed(pr.notification_preferences, 'lineup_published');

explain (analyze, buffers, verbose)
with params as (
  select '00000000-0000-0000-0000-000000000001'::uuid as match_id
)
select
  a.match_id,
  m.group_id,
  a.player_id,
  pt.token,
  public.notification_delivery_allowed(pr.notification_preferences, 'match_result') as allowed
from params p
join public.matches m on m.id = p.match_id
join public.match_attendees a on a.match_id = m.id
join public.push_tokens pt on pt.user_id = a.player_id and pt.is_active = true
join public.profiles pr on pr.id = a.player_id
where a.status = 'going'::public.rsvp_status
  and a.player_id <> m.organizer_id
  and public.notification_delivery_allowed(pr.notification_preferences, 'match_result');

explain (analyze, buffers, verbose)
with params as (
  select '00000000-0000-0000-0000-000000000001'::uuid as match_id
)
select
  a.match_id,
  m.group_id,
  a.player_id,
  pt.token,
  public.notification_delivery_allowed(
    pr.notification_preferences,
    'post_match_rating_reminder'
  ) as allowed
from params p
join public.matches m on m.id = p.match_id
join public.match_attendees a on a.match_id = m.id
join public.push_tokens pt on pt.user_id = a.player_id and pt.is_active = true
join public.profiles pr on pr.id = a.player_id
where a.status = 'going'::public.rsvp_status
  and a.player_id <> m.organizer_id
  and public.notification_delivery_allowed(
    pr.notification_preferences,
    'post_match_rating_reminder'
  );

-- Payment reminders: upcoming group matches in the next 24 hours, unpaid going
-- attendees only.
explain (analyze, buffers, verbose)
select
  m.id as match_id,
  m.group_id,
  a.player_id,
  pt.token,
  public.notification_delivery_allowed(pr.notification_preferences, 'payment_reminder') as allowed
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
  and public.notification_delivery_allowed(pr.notification_preferences, 'payment_reminder');

-- ---------------------------------------------------------------------------
-- 6) Streak-at-risk candidate shape
-- ---------------------------------------------------------------------------

explain (analyze, buffers, verbose)
with runtime as (
  select
    now() as now_at,
    public.week_monday_istanbul(now()) as week_monday,
    public.week_monday_istanbul(now()) - 7 as prev_week_monday
),
candidates as (
  select distinct pr.id as player_id
  from runtime r
  join public.profiles pr on true
  where pr.weekly_match_streak_weeks > 0
    and pr.weekly_match_last_qualifying_week_start is not null
    and pr.weekly_match_last_qualifying_week_start >= r.prev_week_monday
    and not exists (
      select 1
      from public.group_members gm
      join public.matches m on m.group_id = gm.group_id
      where gm.player_id = pr.id
        and m.status = 'upcoming'::public.match_status
        and public.week_monday_istanbul(m.starts_at) = r.week_monday
    )
    and not exists (
      select 1
      from public.match_attendees a
      join public.matches m on m.id = a.match_id
      where a.player_id = pr.id
        and a.status = 'going'::public.rsvp_status
        and m.group_id is not null
        and m.status = 'finished'::public.match_status
        and public.week_monday_istanbul(m.starts_at) = r.week_monday
    )
)
select
  pr.id as recipient_id,
  pt.token,
  public.notification_delivery_allowed(pr.notification_preferences, 'streak_at_risk') as allowed
from public.profiles pr
join public.push_tokens pt on pt.user_id = pr.id and pt.is_active = true
join candidates c on c.player_id = pr.id
where public.notification_delivery_allowed(pr.notification_preferences, 'streak_at_risk');

-- ---------------------------------------------------------------------------
-- 7) Edge worker preference fetch shape
-- ---------------------------------------------------------------------------

explain (analyze, buffers, verbose)
select id, notification_preferences
from public.profiles
where id = any (
  array[
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid
  ]
);

-- ---------------------------------------------------------------------------
-- 8) Only use this if a future direct JSONB containment query is introduced.
--    The current notification pipeline does not use this predicate shape.
-- ---------------------------------------------------------------------------

-- explain (analyze, buffers, verbose)
-- select id
-- from public.profiles
-- where notification_preferences @> '{"types":{"group_match_initial":false}}'::jsonb;
