-- Group match RSVP-aware reminder pipeline behaviour.
-- Validates the migration in 20260512120000_group_match_rsvp_reminders.sql.

begin;

create extension if not exists pgtap with schema extensions;

select plan(25);

select tests.reset_session();

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

-- 6 distinct users covering the RSVP matrix + an inactive-token member.
select tests.create_user('a0000000-0000-4000-8000-000000000010'::uuid); -- organizer
select tests.create_user('a0000000-0000-4000-8000-000000000011'::uuid); -- going member
select tests.create_user('a0000000-0000-4000-8000-000000000012'::uuid); -- not_going member
select tests.create_user('a0000000-0000-4000-8000-000000000013'::uuid); -- maybe member
select tests.create_user('a0000000-0000-4000-8000-000000000014'::uuid); -- no-response member
select tests.create_user('a0000000-0000-4000-8000-000000000015'::uuid); -- inactive-token member

insert into public.groups (id, name, owner_id, join_code)
values (
  'c0000000-0000-4000-8000-000000000050'::uuid,
  'Reminder Group',
  'a0000000-0000-4000-8000-000000000010'::uuid,
  'GRPRMD50'
);

insert into public.group_members (group_id, player_id, role)
values
  ('c0000000-0000-4000-8000-000000000050'::uuid, 'a0000000-0000-4000-8000-000000000010'::uuid, 'owner'),
  ('c0000000-0000-4000-8000-000000000050'::uuid, 'a0000000-0000-4000-8000-000000000011'::uuid, 'member'),
  ('c0000000-0000-4000-8000-000000000050'::uuid, 'a0000000-0000-4000-8000-000000000012'::uuid, 'member'),
  ('c0000000-0000-4000-8000-000000000050'::uuid, 'a0000000-0000-4000-8000-000000000013'::uuid, 'member'),
  ('c0000000-0000-4000-8000-000000000050'::uuid, 'a0000000-0000-4000-8000-000000000014'::uuid, 'member'),
  ('c0000000-0000-4000-8000-000000000050'::uuid, 'a0000000-0000-4000-8000-000000000015'::uuid, 'member');

insert into public.push_tokens (user_id, token, platform, is_active)
values
  ('a0000000-0000-4000-8000-000000000010'::uuid, 'tok-org',      'ios', true),
  ('a0000000-0000-4000-8000-000000000011'::uuid, 'tok-going',    'ios', true),
  ('a0000000-0000-4000-8000-000000000012'::uuid, 'tok-not',      'ios', true),
  ('a0000000-0000-4000-8000-000000000013'::uuid, 'tok-maybe',    'ios', true),
  ('a0000000-0000-4000-8000-000000000014'::uuid, 'tok-noresp',   'ios', true),
  ('a0000000-0000-4000-8000-000000000015'::uuid, 'tok-inactive', 'ios', false);

-- Upcoming, not-full, group-scoped match. Triggers initial broadcast queue.
insert into public.matches (id, starts_at, venue, organizer_id, join_code, group_id, max_players, status)
values (
  'b0000000-0000-4000-8000-000000000080'::uuid,
  now() + interval '2 days',
  'Saha A',
  'a0000000-0000-4000-8000-000000000010'::uuid,
  'MATCHRMD80',
  'c0000000-0000-4000-8000-000000000050'::uuid,
  10,
  'upcoming'
);

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('b0000000-0000-4000-8000-000000000080'::uuid, 'a0000000-0000-4000-8000-000000000010'::uuid, 'going',     false),
  ('b0000000-0000-4000-8000-000000000080'::uuid, 'a0000000-0000-4000-8000-000000000011'::uuid, 'going',     false),
  ('b0000000-0000-4000-8000-000000000080'::uuid, 'a0000000-0000-4000-8000-000000000012'::uuid, 'not_going', false),
  ('b0000000-0000-4000-8000-000000000080'::uuid, 'a0000000-0000-4000-8000-000000000013'::uuid, 'maybe',     false);
-- Members 014 (no-response) and 015 (inactive-token) intentionally have no attendee row.

-- ---------------------------------------------------------------------------
-- Initial broadcast trigger
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.notification_deliveries
   where match_id = 'b0000000-0000-4000-8000-000000000080'::uuid
     and type = 'initial'),
  4,
  'initial trigger queues 4 rows (organizer + inactive token excluded)'
);

select is_empty(
  $$ select 1 from public.notification_deliveries
     where match_id = 'b0000000-0000-4000-8000-000000000080'::uuid
       and recipient_id = 'a0000000-0000-4000-8000-000000000010'::uuid $$,
  'organizer is not queued for initial broadcast'
);

select is_empty(
  $$ select 1 from public.notification_deliveries
     where match_id = 'b0000000-0000-4000-8000-000000000080'::uuid
       and recipient_id = 'a0000000-0000-4000-8000-000000000015'::uuid $$,
  'member with inactive push token is not queued for initial'
);

-- ---------------------------------------------------------------------------
-- Daily reminder enqueue
-- ---------------------------------------------------------------------------

select public.enqueue_group_match_reminders();

select is(
  (select count(*)::int from public.notification_deliveries
   where match_id = 'b0000000-0000-4000-8000-000000000080'::uuid
     and type = 'reminder'),
  2,
  'reminders target only maybe + no-response (2 rows)'
);

select is_empty(
  $$ select 1 from public.notification_deliveries
     where match_id = 'b0000000-0000-4000-8000-000000000080'::uuid
       and type = 'reminder'
       and recipient_id = 'a0000000-0000-4000-8000-000000000011'::uuid $$,
  'going member receives no reminder'
);

select is_empty(
  $$ select 1 from public.notification_deliveries
     where match_id = 'b0000000-0000-4000-8000-000000000080'::uuid
       and type = 'reminder'
       and recipient_id = 'a0000000-0000-4000-8000-000000000012'::uuid $$,
  'not_going member receives no reminder'
);

select isnt_empty(
  $$ select 1 from public.notification_deliveries
     where match_id = 'b0000000-0000-4000-8000-000000000080'::uuid
       and type = 'reminder'
       and recipient_id = 'a0000000-0000-4000-8000-000000000013'::uuid
       and reminder_date is not null $$,
  'maybe member receives reminder with reminder_date set'
);

select isnt_empty(
  $$ select 1 from public.notification_deliveries
     where match_id = 'b0000000-0000-4000-8000-000000000080'::uuid
       and type = 'reminder'
       and recipient_id = 'a0000000-0000-4000-8000-000000000014'::uuid $$,
  'no-response member receives reminder'
);

select is_empty(
  $$ select 1 from public.notification_deliveries
     where match_id = 'b0000000-0000-4000-8000-000000000080'::uuid
       and type = 'reminder'
       and recipient_id = 'a0000000-0000-4000-8000-000000000015'::uuid $$,
  'inactive-token member receives no reminder'
);

select is(
  (select public.enqueue_group_match_reminders()),
  0,
  'reminder enqueue is idempotent within a single day'
);

-- ---------------------------------------------------------------------------
-- RSVP-driven reminder cancellation
-- ---------------------------------------------------------------------------

update public.match_attendees
set status = 'going'::public.rsvp_status
where match_id = 'b0000000-0000-4000-8000-000000000080'::uuid
  and player_id = 'a0000000-0000-4000-8000-000000000013'::uuid;

select is_empty(
  $$ select 1 from public.notification_deliveries
     where match_id = 'b0000000-0000-4000-8000-000000000080'::uuid
       and type = 'reminder'
       and recipient_id = 'a0000000-0000-4000-8000-000000000013'::uuid
       and status = 'pending' $$,
  'pending reminder is dropped when user picks going'
);

insert into public.match_attendees (match_id, player_id, status, paid)
values (
  'b0000000-0000-4000-8000-000000000080'::uuid,
  'a0000000-0000-4000-8000-000000000014'::uuid,
  'not_going'::public.rsvp_status,
  false
);

select is_empty(
  $$ select 1 from public.notification_deliveries
     where match_id = 'b0000000-0000-4000-8000-000000000080'::uuid
       and type = 'reminder'
       and recipient_id = 'a0000000-0000-4000-8000-000000000014'::uuid
       and status = 'pending' $$,
  'pending reminder is dropped when user picks not_going'
);

-- ---------------------------------------------------------------------------
-- Match-full and past-match guards
-- ---------------------------------------------------------------------------

insert into public.matches (id, starts_at, venue, organizer_id, join_code, group_id, max_players, status)
values (
  'b0000000-0000-4000-8000-000000000081'::uuid,
  now() + interval '3 days',
  'Saha B',
  'a0000000-0000-4000-8000-000000000010'::uuid,
  'MATCHRMD81',
  'c0000000-0000-4000-8000-000000000050'::uuid,
  4,
  'upcoming'
);

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('b0000000-0000-4000-8000-000000000081'::uuid, 'a0000000-0000-4000-8000-000000000010'::uuid, 'going', false),
  ('b0000000-0000-4000-8000-000000000081'::uuid, 'a0000000-0000-4000-8000-000000000011'::uuid, 'going', false),
  ('b0000000-0000-4000-8000-000000000081'::uuid, 'a0000000-0000-4000-8000-000000000013'::uuid, 'going', false),
  ('b0000000-0000-4000-8000-000000000081'::uuid, 'a0000000-0000-4000-8000-000000000014'::uuid, 'going', false);

select public.enqueue_group_match_reminders();

select is_empty(
  $$ select 1 from public.notification_deliveries
     where match_id = 'b0000000-0000-4000-8000-000000000081'::uuid
       and type = 'reminder' $$,
  'no reminders are queued for a full match'
);

insert into public.matches (id, starts_at, venue, organizer_id, join_code, group_id, max_players, status)
values (
  'b0000000-0000-4000-8000-000000000082'::uuid,
  now() - interval '1 hour',
  'Saha C',
  'a0000000-0000-4000-8000-000000000010'::uuid,
  'MATCHRMD82',
  'c0000000-0000-4000-8000-000000000050'::uuid,
  10,
  'upcoming'
);

select public.enqueue_group_match_reminders();

select is_empty(
  $$ select 1 from public.notification_deliveries
     where match_id = 'b0000000-0000-4000-8000-000000000082'::uuid
       and type = 'reminder' $$,
  'no reminders are queued for a kicked-off match'
);

-- ---------------------------------------------------------------------------
-- Payment reminder: upcoming within 24h + attendee unpaid + going
-- ---------------------------------------------------------------------------

insert into public.matches (id, starts_at, venue, organizer_id, join_code, group_id, max_players, status)
values (
  'b0000000-0000-4000-8000-000000000083'::uuid,
  now() + interval '6 hours',
  'Saha D',
  'a0000000-0000-4000-8000-000000000010'::uuid,
  'MATCHRMD83',
  'c0000000-0000-4000-8000-000000000050'::uuid,
  10,
  'upcoming'
);

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('b0000000-0000-4000-8000-000000000083'::uuid, 'a0000000-0000-4000-8000-000000000010'::uuid, 'going', false),
  ('b0000000-0000-4000-8000-000000000083'::uuid, 'a0000000-0000-4000-8000-000000000011'::uuid, 'going', false),
  ('b0000000-0000-4000-8000-000000000083'::uuid, 'a0000000-0000-4000-8000-000000000012'::uuid, 'maybe', false),
  ('b0000000-0000-4000-8000-000000000083'::uuid, 'a0000000-0000-4000-8000-000000000013'::uuid, 'going', true);

select public.enqueue_group_match_reminders();

select is(
  (select count(*)::int from public.notification_deliveries
   where match_id = 'b0000000-0000-4000-8000-000000000083'::uuid
     and type = 'payment_reminder'),
  1,
  'payment reminder targets only unpaid going attendee within 24 hours'
);

select is_empty(
  $$ select 1 from public.notification_deliveries
     where match_id = 'b0000000-0000-4000-8000-000000000083'::uuid
       and type = 'payment_reminder'
       and recipient_id = 'a0000000-0000-4000-8000-000000000010'::uuid $$,
  'organizer never receives payment reminder'
);

select is_empty(
  $$ select 1 from public.notification_deliveries
     where match_id = 'b0000000-0000-4000-8000-000000000083'::uuid
       and type = 'payment_reminder'
       and recipient_id = 'a0000000-0000-4000-8000-000000000012'::uuid $$,
  'maybe attendee receives no payment reminder'
);

select is_empty(
  $$ select 1 from public.notification_deliveries
     where match_id = 'b0000000-0000-4000-8000-000000000083'::uuid
       and type = 'payment_reminder'
       and recipient_id = 'a0000000-0000-4000-8000-000000000013'::uuid $$,
  'paid attendee receives no payment reminder'
);

select is(
  (select public.enqueue_group_match_reminders()),
  0,
  'payment reminder enqueue is idempotent within a single day'
);

update public.matches
set status = 'finished'::public.match_status
where id = 'b0000000-0000-4000-8000-000000000083'::uuid;

select is(
  (select count(*)::int from public.notification_deliveries
   where match_id = 'b0000000-0000-4000-8000-000000000083'::uuid
     and type = 'post_match_rating_reminder'),
  2,
  'finished match queues post_match_rating_reminder for all going participants except organizer'
);

select isnt_empty(
  $$ select 1 from public.notification_deliveries
     where match_id = 'b0000000-0000-4000-8000-000000000083'::uuid
       and type = 'post_match_rating_reminder'
       and scheduled_for > now() + interval '14 minutes'
       and scheduled_for <= now() + interval '16 minutes' $$,
  'post_match_rating_reminder is scheduled around +15 minutes'
);

select is(
  (select count(*)::int
   from public.notification_deliveries
   where match_id = 'b0000000-0000-4000-8000-000000000083'::uuid
     and type = 'post_match_rating_reminder'
     and status = 'pending'),
  2,
  'scheduled post_match_rating_reminder rows stay pending before due time'
);

-- ---------------------------------------------------------------------------
-- Drain queue: atomic claim + stale-claim recovery
-- ---------------------------------------------------------------------------

select isnt_empty(
  $$ select 1 from public.claim_pending_deliveries(50)
     where delivery_token is not null and group_name = 'Reminder Group' $$,
  'claim returns rows joined with match + group fixtures'
);

select isnt_empty(
  $$ select 1 from public.notification_deliveries
     where status = 'sending'
       and claimed_at is not null $$,
  'claimed rows are marked sending with claimed_at'
);

insert into public.notification_deliveries
  (match_id, group_id, recipient_id, token, type, status, claimed_at)
values (
  'b0000000-0000-4000-8000-000000000080'::uuid,
  'c0000000-0000-4000-8000-000000000050'::uuid,
  'a0000000-0000-4000-8000-000000000015'::uuid,
  'tok-stale',
  'initial',
  'sending',
  now() - interval '10 minutes'
);

select isnt_empty(
  $$ select 1 from public.claim_pending_deliveries(50)
     where delivery_token = 'tok-stale' $$,
  'claim recovers a row stuck in sending state for >5 minutes'
);

select * from finish();

rollback;
