begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_participant());
select tests.create_user(tests.uuid_non_member());

insert into public.groups (id, name, owner_id, join_code)
values (
  'c0000000-0000-4000-8000-000000000020'::uuid,
  'Group B',
  tests.uuid_organizer(),
  'GRPCODE20'
);

insert into public.group_members (group_id, player_id, role)
values ('c0000000-0000-4000-8000-000000000020'::uuid, tests.uuid_organizer(), 'owner');

-- Owner adds member
select tests.authenticate_as(tests.uuid_organizer());
select lives_ok(
  $$ insert into public.group_members (group_id, player_id, role)
     values ('c0000000-0000-4000-8000-000000000020'::uuid, tests.uuid_participant(), 'member') $$,
  'owner inserts member row'
);

-- Member reads roster
select tests.authenticate_as(tests.uuid_participant());
select isnt_empty(
  $$ select 1 from public.group_members
     where group_id = 'c0000000-0000-4000-8000-000000000020'::uuid $$,
  'member selects group_members'
);

-- Member leaves
select lives_ok(
  $$ delete from public.group_members
     where group_id = 'c0000000-0000-4000-8000-000000000020'::uuid
       and player_id = tests.uuid_participant() $$,
  'member deletes self from group'
);

-- Outsider cannot read roster
select tests.authenticate_as(tests.uuid_non_member());
select is_empty(
  $$ select 1 from public.group_members
     where group_id = 'c0000000-0000-4000-8000-000000000020'::uuid $$,
  'outsider cannot select group_members'
);

-- Outsider cannot add arbitrary member (not owner, not self row for unknown group - actually inserting self with group id might pass with check player_id = auth.uid())
-- Policy allows self-insert: outsider could add self if they know group UUID (documented product behavior).
-- Owner-only add of another user:
select tests.authenticate_as(tests.uuid_non_member());
select throws_ok(
  $$ insert into public.group_members (group_id, player_id, role)
     values (
       'c0000000-0000-4000-8000-000000000020'::uuid,
       'a0000000-0000-4000-8000-000000000002'::uuid,
       'member'
     ) $$,
  '42501'
);

-- No UPDATE policy: member cannot update role
select tests.authenticate_as(tests.uuid_organizer());
insert into public.group_members (group_id, player_id, role)
values ('c0000000-0000-4000-8000-000000000020'::uuid, tests.uuid_participant(), 'member');

select tests.authenticate_as(tests.uuid_participant());
update public.group_members
set role = 'owner'
where group_id = 'c0000000-0000-4000-8000-000000000020'::uuid
  and player_id = tests.uuid_participant();
select is(
  (select role from public.group_members
   where group_id = 'c0000000-0000-4000-8000-000000000020'::uuid
     and player_id = tests.uuid_participant()),
  'member',
  'no update policy on group_members'
);

select tests.authenticate_anon();
select is_empty(
  $$ select 1 from public.group_members limit 1 $$,
  'anon cannot see group_members rows'
);

select * from finish();

rollback;
