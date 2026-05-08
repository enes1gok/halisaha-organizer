-- Lineup lock enqueues lineup_published for going attendees (organizer excluded);
-- respects prefs; skips non-group, cancelled; idempotent on repeated lock.

begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

select tests.reset_session();

select tests.create_user('e1000000-0000-4000-8000-000000000010'::uuid);
select tests.create_user('e1000000-0000-4000-8000-000000000011'::uuid);
select tests.create_user('e1000000-0000-4000-8000-000000000012'::uuid);

insert into public.groups (id, name, owner_id, join_code)
values (
  'd1000000-0000-4000-8000-000000000070'::uuid,
  'Lineup Pub Group',
  'e1000000-0000-4000-8000-000000000010'::uuid,
  'GRPLN070'
);

insert into public.group_members (group_id, player_id, role)
values
  ('d1000000-0000-4000-8000-000000000070'::uuid, 'e1000000-0000-4000-8000-000000000010'::uuid, 'owner'),
  ('d1000000-0000-4000-8000-000000000070'::uuid, 'e1000000-0000-4000-8000-000000000011'::uuid, 'member'),
  ('d1000000-0000-4000-8000-000000000070'::uuid, 'e1000000-0000-4000-8000-000000000012'::uuid, 'member');

insert into public.push_tokens (user_id, token, platform, is_active)
values
  ('e1000000-0000-4000-8000-000000000010'::uuid, 'tok-ln-org', 'ios', true),
  ('e1000000-0000-4000-8000-000000000011'::uuid, 'tok-ln-11', 'ios', true),
  ('e1000000-0000-4000-8000-000000000012'::uuid, 'tok-ln-12', 'ios', true);

update public.profiles
set display_name = 'Org Kadro'
where id = 'e1000000-0000-4000-8000-000000000010'::uuid;

-- Match A: org + 011 going, 012 maybe — only 011 receives lineup_published.
insert into public.matches (
  id,
  starts_at,
  venue,
  organizer_id,
  join_code,
  group_id,
  max_players,
  status,
  lineup_locked
)
values (
  'f1000000-0000-4000-8000-000000000080'::uuid,
  now() + interval '2 days',
  'Saha L1',
  'e1000000-0000-4000-8000-000000000010'::uuid,
  'MTLN080',
  'd1000000-0000-4000-8000-000000000070'::uuid,
  10,
  'upcoming'::public.match_status,
  false
);

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('f1000000-0000-4000-8000-000000000080'::uuid, 'e1000000-0000-4000-8000-000000000010'::uuid, 'going', false),
  ('f1000000-0000-4000-8000-000000000080'::uuid, 'e1000000-0000-4000-8000-000000000011'::uuid, 'going', false),
  ('f1000000-0000-4000-8000-000000000080'::uuid, 'e1000000-0000-4000-8000-000000000012'::uuid, 'maybe', false);

update public.matches
set lineup_locked = true
where id = 'f1000000-0000-4000-8000-000000000080'::uuid;

select is(
  (select count(*)::int from public.notification_deliveries
   where match_id = 'f1000000-0000-4000-8000-000000000080'::uuid
     and type = 'lineup_published'),
  1,
  'going-only non-organizer member gets lineup_published'
);

select is(
  (select recipient_id from public.notification_deliveries
   where match_id = 'f1000000-0000-4000-8000-000000000080'::uuid
     and type = 'lineup_published'
   limit 1),
  'e1000000-0000-4000-8000-000000000011'::uuid,
  'lineup recipient is the going member, not organizer'
);

select is_empty(
  $$ select 1 from public.notification_deliveries
     where match_id = 'f1000000-0000-4000-8000-000000000080'::uuid
       and type = 'lineup_published'
       and recipient_id = 'e1000000-0000-4000-8000-000000000010'::uuid $$,
  'organizer never receives lineup_published'
);

update public.matches
set lineup_locked = true
where id = 'f1000000-0000-4000-8000-000000000080'::uuid;

select is(
  (select count(*)::int from public.notification_deliveries
   where match_id = 'f1000000-0000-4000-8000-000000000080'::uuid
     and type = 'lineup_published'),
  1,
  're-setting lineup_locked idempotent: no duplicate deliveries'
);

-- Cancelled match: locking lineup does not enqueue.
insert into public.matches (
  id,
  starts_at,
  venue,
  organizer_id,
  join_code,
  group_id,
  max_players,
  status,
  lineup_locked
)
values (
  'f1000000-0000-4000-8000-000000000081'::uuid,
  now() + interval '3 days',
  'Saha L2',
  'e1000000-0000-4000-8000-000000000010'::uuid,
  'MTLN081',
  'd1000000-0000-4000-8000-000000000070'::uuid,
  10,
  'cancelled'::public.match_status,
  false
);

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('f1000000-0000-4000-8000-000000000081'::uuid, 'e1000000-0000-4000-8000-000000000011'::uuid, 'going', false);

update public.matches
set lineup_locked = true
where id = 'f1000000-0000-4000-8000-000000000081'::uuid;

select is_empty(
  $$ select 1 from public.notification_deliveries
     where match_id = 'f1000000-0000-4000-8000-000000000081'::uuid
       and type = 'lineup_published' $$,
  'cancelled match skips lineup enqueue'
);

-- Preference off: no delivery for that recipient.
update public.profiles
set notification_preferences = jsonb_build_object(
  'types',
  jsonb_build_object('group_match_lineup_published', false)
)
where id = 'e1000000-0000-4000-8000-000000000011'::uuid;

insert into public.matches (
  id,
  starts_at,
  venue,
  organizer_id,
  join_code,
  group_id,
  max_players,
  status,
  lineup_locked
)
values (
  'f1000000-0000-4000-8000-000000000082'::uuid,
  now() + interval '4 days',
  'Saha L3',
  'e1000000-0000-4000-8000-000000000010'::uuid,
  'MTLN082',
  'd1000000-0000-4000-8000-000000000070'::uuid,
  10,
  'upcoming'::public.match_status,
  false
);

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('f1000000-0000-4000-8000-000000000082'::uuid, 'e1000000-0000-4000-8000-000000000011'::uuid, 'going', false);

update public.matches
set lineup_locked = true
where id = 'f1000000-0000-4000-8000-000000000082'::uuid;

select is_empty(
  $$ select 1 from public.notification_deliveries
     where match_id = 'f1000000-0000-4000-8000-000000000082'::uuid
       and type = 'lineup_published' $$,
  'lineup enqueue respects disabled group_match_lineup_published preference'
);

-- Non-group match: no lineup enqueue.
insert into public.matches (
  id,
  starts_at,
  venue,
  organizer_id,
  join_code,
  group_id,
  max_players,
  status,
  lineup_locked
)
values (
  'f1000000-0000-4000-8000-000000000083'::uuid,
  now() + interval '5 days',
  'Saha Solo',
  'e1000000-0000-4000-8000-000000000010'::uuid,
  'MTLN083',
  null,
  10,
  'upcoming'::public.match_status,
  false
);

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('f1000000-0000-4000-8000-000000000083'::uuid, 'e1000000-0000-4000-8000-000000000011'::uuid, 'going', false);

update public.matches
set lineup_locked = true
where id = 'f1000000-0000-4000-8000-000000000083'::uuid;

select is_empty(
  $$ select 1 from public.notification_deliveries
     where match_id = 'f1000000-0000-4000-8000-000000000083'::uuid
       and type = 'lineup_published' $$,
  'match without group_id skips lineup enqueue'
);

select is(
  (select org.display_name
   from public.notification_deliveries nd
   join public.matches m on m.id = nd.match_id
   join public.profiles org on org.id = m.organizer_id
   where nd.match_id = 'f1000000-0000-4000-8000-000000000080'::uuid
     and nd.type = 'lineup_published'
   limit 1),
  'Org Kadro',
  'match joins organizer profile for lineup message context'
);

select isnt_empty(
  $$ select organizer_display_name from public.claim_pending_deliveries(50)
     where match_id = 'f1000000-0000-4000-8000-000000000080'::uuid
       and delivery_type = 'lineup_published'
       and organizer_display_name = 'Org Kadro' $$,
  'claim_pending_deliveries returns organizer_display_name for lineup_published'
);

select * from finish();

rollback;
