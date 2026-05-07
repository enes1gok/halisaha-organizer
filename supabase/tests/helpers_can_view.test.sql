begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_participant());
select tests.create_user(tests.uuid_non_member());

-- Match visible to organizer + attendee, not outsider
insert into public.matches (id, starts_at, venue, organizer_id, join_code)
values (
  'b0000000-0000-4000-8000-000000000001'::uuid,
  now() + interval '1 day',
  'RLS test venue',
  tests.uuid_organizer(),
  'RLSTESTJOIN1'
);

insert into public.match_attendees (match_id, player_id, status, paid)
values ('b0000000-0000-4000-8000-000000000001'::uuid, tests.uuid_participant(), 'going', false);

select ok(
  public.is_match_organizer('b0000000-0000-4000-8000-000000000001'::uuid, tests.uuid_organizer()),
  'is_match_organizer true for organizer'
);

select ok(
  not public.is_match_organizer('b0000000-0000-4000-8000-000000000001'::uuid, tests.uuid_participant()),
  'is_match_organizer false for participant'
);

select ok(
  public.can_view_match('b0000000-0000-4000-8000-000000000001'::uuid, tests.uuid_organizer()),
  'can_view_match true for organizer'
);

select ok(
  public.can_view_match('b0000000-0000-4000-8000-000000000001'::uuid, tests.uuid_participant()),
  'can_view_match true for attendee'
);

select ok(
  not public.can_view_match('b0000000-0000-4000-8000-000000000001'::uuid, tests.uuid_non_member()),
  'can_view_match false for unrelated user'
);

-- Group visibility
insert into public.groups (id, name, owner_id, join_code)
values (
  'c0000000-0000-4000-8000-000000000001'::uuid,
  'RLS Test Group',
  tests.uuid_organizer(),
  'GRPJOIN01'
);

insert into public.group_members (group_id, player_id, role)
values ('c0000000-0000-4000-8000-000000000001'::uuid, tests.uuid_organizer(), 'owner');

insert into public.group_members (group_id, player_id, role)
values ('c0000000-0000-4000-8000-000000000001'::uuid, tests.uuid_participant(), 'member');

select ok(
  public.can_view_group('c0000000-0000-4000-8000-000000000001'::uuid, tests.uuid_organizer()),
  'can_view_group true for owner member row'
);

select ok(
  public.can_view_group('c0000000-0000-4000-8000-000000000001'::uuid, tests.uuid_participant()),
  'can_view_group true for member'
);

select ok(
  not public.can_view_group('c0000000-0000-4000-8000-000000000001'::uuid, tests.uuid_non_member()),
  'can_view_group false for non member'
);

-- Group-scoped match visible to group member without direct attendee row
update public.matches
set group_id = 'c0000000-0000-4000-8000-000000000001'::uuid
where id = 'b0000000-0000-4000-8000-000000000001'::uuid;

select ok(
  not public.can_view_match('b0000000-0000-4000-8000-000000000001'::uuid, tests.uuid_non_member()),
  'match linked to group: outsider not in group cannot view'
);

insert into public.group_members (group_id, player_id, role)
values ('c0000000-0000-4000-8000-000000000001'::uuid, tests.uuid_non_member(), 'member');

select ok(
  public.can_view_match('b0000000-0000-4000-8000-000000000001'::uuid, tests.uuid_non_member()),
  'after joining group, user can view group-scoped match'
);

select * from finish();

rollback;
