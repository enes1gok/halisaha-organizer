begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_participant());
select tests.create_user(tests.uuid_non_member());

insert into public.groups (id, name, owner_id, join_code)
values (
  'c0000000-0000-4000-8000-000000000010'::uuid,
  'Group A',
  tests.uuid_organizer(),
  'GRPCODE10'
);

insert into public.group_members (group_id, player_id, role)
values
  ('c0000000-0000-4000-8000-000000000010'::uuid, tests.uuid_organizer(), 'owner'),
  ('c0000000-0000-4000-8000-000000000010'::uuid, tests.uuid_participant(), 'member');

-- Member sees group
select tests.authenticate_as(tests.uuid_participant());
select isnt_empty(
  $$ select id from public.groups where id = 'c0000000-0000-4000-8000-000000000010'::uuid $$,
  'member selects group'
);

-- Non-member cannot
select tests.authenticate_as(tests.uuid_non_member());
select is_empty(
  $$ select id from public.groups where id = 'c0000000-0000-4000-8000-000000000010'::uuid $$,
  'outsider cannot select group'
);

-- Owner updates name
select tests.authenticate_as(tests.uuid_organizer());
select lives_ok(
  $$ update public.groups set name = 'Group A2' where id = 'c0000000-0000-4000-8000-000000000010'::uuid $$,
  'owner updates group'
);

-- Member cannot update
select tests.authenticate_as(tests.uuid_participant());
update public.groups set name = 'Hack' where id = 'c0000000-0000-4000-8000-000000000010'::uuid;
select is(
  (select name from public.groups where id = 'c0000000-0000-4000-8000-000000000010'::uuid),
  'Group A2',
  'member cannot update group'
);

-- Insert as self owner
select tests.authenticate_as(tests.uuid_organizer());
select lives_ok(
  $$ insert into public.groups (name, owner_id, join_code)
     values ('New G', tests.uuid_organizer(), 'NEWGRPC11') $$,
  'authenticated inserts group as owner'
);

-- Insert with wrong owner_id
select throws_ok(
  $$ insert into public.groups (name, owner_id, join_code)
     values (
       'Bad',
       'a0000000-0000-4000-8000-000000000002'::uuid,
       'NEWGRPC12'
     ) $$,
  '42501'
);

-- Delete group: no policy (zero rows deleted, no error)
select lives_ok(
  $$ delete from public.groups where id = 'c0000000-0000-4000-8000-000000000010'::uuid $$,
  'organizer delete attempt does not raise'
);
select isnt_empty(
  $$ select 1 from public.groups where id = 'c0000000-0000-4000-8000-000000000010'::uuid $$,
  'group row remains (no delete policy)'
);

select tests.authenticate_anon();
select is_empty(
  $$ select id from public.groups limit 1 $$,
  'anon cannot see groups rows'
);

select * from finish();

rollback;
