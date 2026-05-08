-- Match cancellation clears pending deliveries and enqueues match_cancelled.
-- Venue updates enqueue venue_change for going attendees only (respects prefs).

begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select tests.reset_session();

-- Organizer + two members (tokens active).
select tests.create_user('e0000000-0000-4000-8000-000000000010'::uuid);
select tests.create_user('e0000000-0000-4000-8000-000000000011'::uuid);
select tests.create_user('e0000000-0000-4000-8000-000000000012'::uuid);

insert into public.groups (id, name, owner_id, join_code)
values (
  'd0000000-0000-4000-8000-000000000070'::uuid,
  'Cancel Venue Group',
  'e0000000-0000-4000-8000-000000000010'::uuid,
  'GRPCVN70'
);

insert into public.group_members (group_id, player_id, role)
values
  ('d0000000-0000-4000-8000-000000000070'::uuid, 'e0000000-0000-4000-8000-000000000010'::uuid, 'owner'),
  ('d0000000-0000-4000-8000-000000000070'::uuid, 'e0000000-0000-4000-8000-000000000011'::uuid, 'member'),
  ('d0000000-0000-4000-8000-000000000070'::uuid, 'e0000000-0000-4000-8000-000000000012'::uuid, 'member');

insert into public.push_tokens (user_id, token, platform, is_active)
values
  ('e0000000-0000-4000-8000-000000000010'::uuid, 'tok-e-org', 'ios', true),
  ('e0000000-0000-4000-8000-000000000011'::uuid, 'tok-e-11', 'ios', true),
  ('e0000000-0000-4000-8000-000000000012'::uuid, 'tok-e-12', 'ios', true);

insert into public.matches (id, starts_at, venue, organizer_id, join_code, group_id, max_players, status)
values (
  'f0000000-0000-4000-8000-000000000080'::uuid,
  now() + interval '2 days',
  'Saha Önce',
  'e0000000-0000-4000-8000-000000000010'::uuid,
  'MTCVN080',
  'd0000000-0000-4000-8000-000000000070'::uuid,
  10,
  'upcoming'::public.match_status
);

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('f0000000-0000-4000-8000-000000000080'::uuid, 'e0000000-0000-4000-8000-000000000010'::uuid, 'going', false),
  ('f0000000-0000-4000-8000-000000000080'::uuid, 'e0000000-0000-4000-8000-000000000011'::uuid, 'going', false),
  ('f0000000-0000-4000-8000-000000000080'::uuid, 'e0000000-0000-4000-8000-000000000012'::uuid, 'maybe', false);

select public.enqueue_group_match_reminders();

select is(
  (select count(*)::int from public.notification_deliveries
   where match_id = 'f0000000-0000-4000-8000-000000000080'::uuid
     and status = 'pending'),
  3,
  'before cancel: initial (2) + reminder for maybe (1) pending'
);

update public.matches
set status = 'cancelled'::public.match_status
where id = 'f0000000-0000-4000-8000-000000000080'::uuid;

select is(
  (select count(*)::int from public.notification_deliveries
   where match_id = 'f0000000-0000-4000-8000-000000000080'::uuid
     and status = 'pending'),
  2,
  'after cancel: only match_cancelled rows remain pending'
);

select is(
  (select count(*)::int from public.notification_deliveries
   where match_id = 'f0000000-0000-4000-8000-000000000080'::uuid
     and type = 'match_cancelled'
     and status = 'pending'),
  2,
  'match_cancelled queued for two non-organizer members'
);

select is_empty(
  $$ select 1 from public.notification_deliveries
     where match_id = 'f0000000-0000-4000-8000-000000000080'::uuid
       and type = 'match_cancelled'
       and recipient_id = 'e0000000-0000-4000-8000-000000000010'::uuid $$,
  'organizer does not receive cancellation push enqueue'
);

-- Venue change: second match, going attendee only (non-organizer).
insert into public.matches (id, starts_at, venue, organizer_id, join_code, group_id, max_players, status)
values (
  'f0000000-0000-4000-8000-000000000081'::uuid,
  now() + interval '3 days',
  'Saha A',
  'e0000000-0000-4000-8000-000000000010'::uuid,
  'MTCVN081',
  'd0000000-0000-4000-8000-000000000070'::uuid,
  10,
  'upcoming'::public.match_status
);

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('f0000000-0000-4000-8000-000000000081'::uuid, 'e0000000-0000-4000-8000-000000000010'::uuid, 'going', false),
  ('f0000000-0000-4000-8000-000000000081'::uuid, 'e0000000-0000-4000-8000-000000000011'::uuid, 'going', false);

select is(
  (select count(*)::int from public.notification_deliveries
   where match_id = 'f0000000-0000-4000-8000-000000000081'::uuid
     and type = 'initial'
     and status = 'pending'),
  2,
  'second match initial targets all non-organizer group members (011 and 012)'
);

update public.matches
set venue = 'Saha B'
where id = 'f0000000-0000-4000-8000-000000000081'::uuid;

select is(
  (select count(*)::int from public.notification_deliveries
   where match_id = 'f0000000-0000-4000-8000-000000000081'::uuid
     and type = 'venue_change'
     and recipient_id = 'e0000000-0000-4000-8000-000000000011'::uuid),
  1,
  'venue update queues venue_change for going member'
);

update public.profiles
set notification_preferences = jsonb_build_object(
  'types',
  jsonb_build_object('group_match_venue_change', false)
)
where id = 'e0000000-0000-4000-8000-000000000011'::uuid;

insert into public.matches (id, starts_at, venue, organizer_id, join_code, group_id, max_players, status)
values (
  'f0000000-0000-4000-8000-000000000082'::uuid,
  now() + interval '4 days',
  'Saha X',
  'e0000000-0000-4000-8000-000000000010'::uuid,
  'MTCVN082',
  'd0000000-0000-4000-8000-000000000070'::uuid,
  10,
  'upcoming'::public.match_status
);

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('f0000000-0000-4000-8000-000000000082'::uuid, 'e0000000-0000-4000-8000-000000000010'::uuid, 'going', false),
  ('f0000000-0000-4000-8000-000000000082'::uuid, 'e0000000-0000-4000-8000-000000000011'::uuid, 'going', false);

update public.matches
set venue = 'Saha Y'
where id = 'f0000000-0000-4000-8000-000000000082'::uuid;

select is_empty(
  $$ select 1 from public.notification_deliveries
     where match_id = 'f0000000-0000-4000-8000-000000000082'::uuid
       and type = 'venue_change' $$,
  'venue_change enqueue respects disabled group_match_venue_change preference'
);

select * from finish();

rollback;
