begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_participant());

insert into public.groups (id, name, owner_id, join_code)
values (
  'd0000000-0000-4000-8000-000000000020'::uuid,
  'RPC delete group',
  tests.uuid_organizer(),
  'GRPCDEL20'
);

insert into public.group_members (group_id, player_id, role)
values
  ('d0000000-0000-4000-8000-000000000020'::uuid, tests.uuid_organizer(), 'owner'),
  ('d0000000-0000-4000-8000-000000000020'::uuid, tests.uuid_participant(), 'member');

insert into public.matches (id, starts_at, venue, organizer_id, join_code, group_id)
values (
  'e0000000-0000-4000-8000-000000000001'::uuid,
  now() + interval '1 day',
  'Delete RPC venue',
  tests.uuid_organizer(),
  'DELMATCH01',
  'd0000000-0000-4000-8000-000000000020'::uuid
);

-- 1) Session without JWT (privileged reset_session): ERR_AUTH_REQUIRED
select tests.reset_session();
select throws_ok(
  $$ select public.delete_group('d0000000-0000-4000-8000-000000000020'::uuid) $$,
  'P0001',
  'ERR_AUTH_REQUIRED',
  'delete_group_without_jwt_requires_auth'
);

-- 2) Member cannot delete
select tests.authenticate_as(tests.uuid_participant());
select throws_ok(
  $$ select public.delete_group('d0000000-0000-4000-8000-000000000020'::uuid) $$,
  'P0001',
  'ERR_GROUP_DELETE_FORBIDDEN',
  'member_delete_forbidden'
);

-- 3) Missing group id
select tests.reset_session();
select tests.authenticate_as(tests.uuid_organizer());
select throws_ok(
  $$ select public.delete_group('f0000000-0000-4000-8000-000000000099'::uuid) $$,
  'P0001',
  'ERR_GROUP_NOT_FOUND',
  'delete_missing_group'
);

-- 4) Owner deletes: return id, cascade memberships, set null on matches.group_id
select tests.reset_session();
select tests.authenticate_as(tests.uuid_organizer());
select is(
  public.delete_group('d0000000-0000-4000-8000-000000000020'::uuid),
  'd0000000-0000-4000-8000-000000000020'::uuid,
  'owner_delete_returns_id'
);

select is_empty(
  $$ select 1 from public.groups where id = 'd0000000-0000-4000-8000-000000000020'::uuid $$,
  'group_row_removed'
);

select is_empty(
  $$ select 1 from public.group_members where group_id = 'd0000000-0000-4000-8000-000000000020'::uuid $$,
  'group_members_cascade'
);

select is(
  (select group_id from public.matches where id = 'e0000000-0000-4000-8000-000000000001'::uuid),
  null::uuid,
  'match_group_id_set_null'
);

-- 5) Second delete: idempotent NOT_FOUND
select tests.reset_session();
select tests.authenticate_as(tests.uuid_organizer());
select throws_ok(
  $$ select public.delete_group('d0000000-0000-4000-8000-000000000020'::uuid) $$,
  'P0001',
  'ERR_GROUP_NOT_FOUND',
  'second_delete_not_found'
);

select * from finish();

rollback;
