begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_participant());

update public.profiles set display_name = 'ParticipantLabel' where id = tests.uuid_participant();

-- Fixture: sensitive columns on participant (only superuser session can set without RLS surprises on UPDATE)
select tests.reset_session();
update public.profiles
set
  iban = 'TR330006100519786457841326',
  notification_preferences = '{"push_enabled": true}'::jsonb
where
  id = tests.uuid_participant();

-- Cannot read another user's full profile row
select tests.authenticate_as(tests.uuid_organizer());

select is_empty(
  $$ select id from public.profiles where id = tests.uuid_participant() $$,
  'authenticated cannot select another user profiles row'
);

select is_empty(
  $$ select iban from public.profiles where id = tests.uuid_participant() $$,
  'authenticated cannot read another user iban from profiles'
);

-- Roster view still works (non-sensitive columns only)
select isnt_empty(
  $$ select id from public.profiles_public where id = tests.uuid_participant() $$,
  'profiles_public allows cross-user roster reads'
);

select is(
  (
    select display_name
    from public.profiles_public
    where
      id = tests.uuid_participant()
  ),
  'ParticipantLabel',
  'profiles_public display_name visible cross-user'
);

-- Own row: full table includes sensitive fields
select tests.authenticate_as(tests.uuid_participant());

select is(
  (select iban from public.profiles where id = tests.uuid_participant()),
  'TR330006100519786457841326',
  'user reads own iban via profiles'
);

-- Own update allowed
select tests.authenticate_as(tests.uuid_organizer());

select lives_ok(
  $$ update public.profiles set display_name = 'OrgDisplay' where id = tests.uuid_organizer() $$,
  'organizer updates own profile'
);

-- Cannot update someone else (0 rows / no throw — verify unchanged)
select tests.authenticate_as(tests.uuid_organizer());

update public.profiles set display_name = 'HackedName' where id = tests.uuid_participant();

-- Verify as privileged session (organizer session cannot SELECT other users' profiles rows)
select tests.reset_session();

select is(
  (select display_name from public.profiles where id = tests.uuid_participant()),
  'ParticipantLabel',
  'cannot change another users display_name via RLS'
);

-- INSERT / DELETE denied for authenticated (no policy)
select tests.authenticate_as(tests.uuid_organizer());

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
