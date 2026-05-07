begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_participant());
select tests.create_user(tests.uuid_non_member());

insert into public.matches (id, starts_at, venue, organizer_id, join_code)
values (
  'b0000000-0000-4000-8000-000000000010'::uuid,
  now() + interval '1 day',
  'Venue',
  tests.uuid_organizer(),
  'MATCHJOIN10'
);

insert into public.match_attendees (match_id, player_id, status, paid)
values ('b0000000-0000-4000-8000-000000000010'::uuid, tests.uuid_participant(), 'going', false);

-- Organizer: select + update + delete
select tests.authenticate_as(tests.uuid_organizer());
select isnt_empty(
  $$ select id from public.matches where id = 'b0000000-0000-4000-8000-000000000010'::uuid $$,
  'organizer selects own match'
);

select lives_ok(
  $$ update public.matches set venue = 'Venue2' where id = 'b0000000-0000-4000-8000-000000000010'::uuid $$,
  'organizer updates match'
);

-- Participant: select only
select tests.authenticate_as(tests.uuid_participant());
select isnt_empty(
  $$ select id from public.matches where id = 'b0000000-0000-4000-8000-000000000010'::uuid $$,
  'participant selects visible match'
);

update public.matches set venue = 'No' where id = 'b0000000-0000-4000-8000-000000000010'::uuid;
select is(
  (select venue from public.matches where id = 'b0000000-0000-4000-8000-000000000010'::uuid),
  'Venue2',
  'participant update affects zero rows (venue unchanged)'
);

delete from public.matches where id = 'b0000000-0000-4000-8000-000000000010'::uuid;
select isnt_empty(
  $$ select 1 from public.matches where id = 'b0000000-0000-4000-8000-000000000010'::uuid $$,
  'participant delete affects zero rows'
);

-- Non-member: no visibility
select tests.authenticate_as(tests.uuid_non_member());
select is_empty(
  $$ select id from public.matches where id = 'b0000000-0000-4000-8000-000000000010'::uuid $$,
  'non_member cannot select match'
);

select throws_ok(
  $$ insert into public.matches (starts_at, venue, organizer_id, join_code)
     values (now(), 'x', tests.uuid_organizer(), 'NEWJOIN99') $$,
  '42501'
);

-- Organizer insert as another user id (with check violation)
select tests.authenticate_as(tests.uuid_organizer());
select throws_ok(
  $$ insert into public.matches (starts_at, venue, organizer_id, join_code)
     values (now(), 'x', tests.uuid_participant(), 'BADORG01') $$,
  '42501'
);

-- Valid insert for self
select lives_ok(
  $$ insert into public.matches (starts_at, venue, organizer_id, join_code)
     values (now() + interval '2 day', 'New', tests.uuid_organizer(), 'NEWJOIN02') $$,
  'organizer inserts match as self'
);

-- Anon: no direct table access
select tests.authenticate_anon();
select is_empty(
  $$ select id from public.matches limit 1 $$,
  'anon cannot see matches rows'
);

-- Organizer cleanup delete (back as organizer)
select tests.reset_session();
select tests.authenticate_as(tests.uuid_organizer());
select lives_ok(
  $$ delete from public.matches where join_code = 'NEWJOIN02' $$,
  'organizer deletes inserted match'
);

select lives_ok(
  $$ delete from public.matches where id = 'b0000000-0000-4000-8000-000000000010'::uuid $$,
  'organizer deletes fixture match'
);

select * from finish();

rollback;
