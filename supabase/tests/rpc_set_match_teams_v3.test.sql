-- Coverage for set_match_teams_v3 — slot positions + lineup_formation_id persistence.

begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_participant());
select tests.create_user(tests.uuid_non_member());

insert into public.matches (id, starts_at, venue, organizer_id, join_code, lineup_locked, max_players)
values (
  'b0000000-0000-4000-8000-0000000000A0'::uuid,
  now() + interval '1 day',
  'Venue',
  tests.uuid_organizer(),
  'V3JOIN0001',
  false,
  14
);

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('b0000000-0000-4000-8000-0000000000A0'::uuid, tests.uuid_participant(), 'going', false),
  ('b0000000-0000-4000-8000-0000000000A0'::uuid, tests.uuid_organizer(),  'going', false);

-- 1. Organizer can write slot indices and formation id
select tests.authenticate_as(tests.uuid_organizer());
select lives_ok(
  $$
    select public.set_match_teams_v3(
      'b0000000-0000-4000-8000-0000000000A0'::uuid,
      array[tests.uuid_organizer(), tests.uuid_participant()],
      array[]::uuid[],
      array[3, 1],
      array[]::int[],
      array[]::uuid[],
      array[]::uuid[],
      null,
      null,
      '4-3-3'
    )
  $$,
  'organizer writes slot_index + formation id'
);

-- 2. Stored slot_index matches the call
select is(
  (
    select slot_index
    from public.match_team_players
    where match_id = 'b0000000-0000-4000-8000-0000000000A0'::uuid
      and player_id = tests.uuid_organizer()
  ),
  3,
  'organizer slot_index persisted as 3'
);

-- 3. lineup_formation_id stored on matches row
select is(
  (
    select lineup_formation_id
    from public.matches
    where id = 'b0000000-0000-4000-8000-0000000000A0'::uuid
  ),
  '4-3-3',
  'lineup_formation_id persisted'
);

-- 4. Unique slot constraint per (match, team): second player at slot 3 must fail
select tests.reset_session();
select throws_ok(
  $$
    insert into public.match_team_players (match_id, player_id, team, slot_index)
    values (
      'b0000000-0000-4000-8000-0000000000A0'::uuid,
      tests.uuid_non_member(),
      'A'::public.team_side,
      3
    )
  $$,
  '23505'
);

-- 5. Slot-array length mismatch raises ERR_LINEUP_SLOT_LENGTH_MISMATCH
select tests.authenticate_as(tests.uuid_organizer());
select throws_ok(
  $$
    select public.set_match_teams_v3(
      'b0000000-0000-4000-8000-0000000000A0'::uuid,
      array[tests.uuid_organizer(), tests.uuid_participant()],
      array[]::uuid[],
      array[0],
      null,
      array[]::uuid[],
      array[]::uuid[]
    )
  $$,
  'P0001',
  'ERR_LINEUP_SLOT_LENGTH_MISMATCH'
);

-- 6. Non-organizer cannot invoke RPC
select tests.authenticate_as(tests.uuid_participant());
select throws_ok(
  $$
    select public.set_match_teams_v3(
      'b0000000-0000-4000-8000-0000000000A0'::uuid,
      array[tests.uuid_participant()],
      array[]::uuid[],
      array[0],
      null,
      array[]::uuid[],
      array[]::uuid[]
    )
  $$,
  'P0001',
  'ERR_NOT_AUTHORIZED'
);

-- 7. Anonymous cannot invoke RPC
select tests.authenticate_anon();
select throws_ok(
  $$
    select public.set_match_teams_v3(
      'b0000000-0000-4000-8000-0000000000A0'::uuid,
      array[tests.uuid_organizer()],
      array[]::uuid[],
      array[0],
      null,
      array[]::uuid[],
      array[]::uuid[]
    )
  $$
);

-- 8. Subsequent v3 call replaces previous slot_index assignments cleanly
select tests.authenticate_as(tests.uuid_organizer());
select lives_ok(
  $$
    select public.set_match_teams_v3(
      'b0000000-0000-4000-8000-0000000000A0'::uuid,
      array[tests.uuid_organizer()],
      array[tests.uuid_participant()],
      array[5],
      array[2],
      array[]::uuid[],
      array[]::uuid[],
      null,
      null,
      '4-4-2'
    )
  $$,
  'second v3 call replaces previous slot assignments'
);

select * from finish();

rollback;
