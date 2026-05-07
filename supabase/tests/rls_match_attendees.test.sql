begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_participant());
select tests.create_user(tests.uuid_non_member());

insert into public.matches (id, starts_at, venue, organizer_id, join_code)
values (
  'b0000000-0000-4000-8000-000000000020'::uuid,
  now() + interval '1 day',
  'Venue',
  tests.uuid_organizer(),
  'MATCHJOIN20'
);

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('b0000000-0000-4000-8000-000000000020'::uuid, tests.uuid_participant(), 'going', false),
  ('b0000000-0000-4000-8000-000000000020'::uuid, tests.uuid_organizer(), 'going', false);

-- Participant: read + own update
select tests.authenticate_as(tests.uuid_participant());
select isnt_empty(
  $$ select 1 from public.match_attendees
     where match_id = 'b0000000-0000-4000-8000-000000000020'::uuid $$,
  'participant selects attendees'
);

select throws_ok(
  $$ insert into public.match_attendees (match_id, player_id, status, paid)
     values ('b0000000-0000-4000-8000-000000000020'::uuid, tests.uuid_non_member(), 'going', false) $$,
  '42501'
);

select lives_ok(
  $$ update public.match_attendees
     set status = 'maybe'::public.rsvp_status
     where match_id = 'b0000000-0000-4000-8000-000000000020'::uuid
       and player_id = tests.uuid_participant() $$,
  'participant updates own attendee row'
);

update public.match_attendees
set status = 'not_going'::public.rsvp_status
where match_id = 'b0000000-0000-4000-8000-000000000020'::uuid
  and player_id = tests.uuid_organizer();
select is(
  (select status::text from public.match_attendees
   where match_id = 'b0000000-0000-4000-8000-000000000020'::uuid and player_id = tests.uuid_organizer()),
  'going',
  'participant cannot change organizer attendee row'
);

-- Organizer: insert + delete other
select tests.authenticate_as(tests.uuid_organizer());
select lives_ok(
  $$ insert into public.match_attendees (match_id, player_id, status, paid)
     values ('b0000000-0000-4000-8000-000000000020'::uuid, tests.uuid_non_member(), 'going', false) $$,
  'organizer inserts attendee'
);

select lives_ok(
  $$ delete from public.match_attendees
     where match_id = 'b0000000-0000-4000-8000-000000000020'::uuid
       and player_id = tests.uuid_non_member() $$,
  'organizer deletes attendee'
);

-- Non-member: no rows visible
select tests.authenticate_as(tests.uuid_non_member());
select is_empty(
  $$ select 1 from public.match_attendees
     where match_id = 'b0000000-0000-4000-8000-000000000020'::uuid $$,
  'non_member cannot select attendees'
);

select tests.authenticate_anon();
select throws_ok($$ select 1 from public.match_attendees limit 1 $$, '42501');

select * from finish();

rollback;
