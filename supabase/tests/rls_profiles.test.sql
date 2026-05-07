begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_participant());

update public.profiles set display_name = 'ParticipantLabel' where id = tests.uuid_participant();

-- Authenticated can read profiles
select tests.authenticate_as(tests.uuid_organizer());
select isnt_empty($$ select id from public.profiles where id = tests.uuid_participant() $$, 'authenticated can select other profile');

-- Own update allowed
select lives_ok(
  $$ update public.profiles set display_name = 'OrgDisplay' where id = tests.uuid_organizer() $$,
  'organizer updates own profile'
);

-- Cannot update someone else (0 rows / no throw — verify unchanged)
select tests.authenticate_as(tests.uuid_organizer());
update public.profiles set display_name = 'HackedName' where id = tests.uuid_participant();
select is(
  (select display_name from public.profiles where id = tests.uuid_participant()),
  'ParticipantLabel',
  'cannot change another users display_name via RLS'
);

-- INSERT / DELETE denied for authenticated (no policy)
select throws_ok(
  $$ insert into public.profiles (id, display_name) values (gen_random_uuid(), 'x') $$,
  '42501'
);

select lives_ok(
  $$ delete from public.profiles where id = tests.uuid_organizer() $$,
  'delete own profile does not raise under RLS'
);
select isnt_empty(
  $$ select 1 from public.profiles where id = tests.uuid_organizer() $$,
  'profile row remains (no delete policy)'
);

-- Anon cannot select profiles
select tests.authenticate_anon();
select is_empty(
  $$ select id from public.profiles limit 1 $$,
  'anon cannot see profiles rows'
);

select * from finish();

rollback;
