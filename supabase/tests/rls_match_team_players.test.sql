begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_participant());
select tests.create_user(tests.uuid_non_member());

insert into public.matches (id, starts_at, venue, organizer_id, join_code, lineup_locked)
values (
  'b0000000-0000-4000-8000-000000000030'::uuid,
  now() + interval '1 day',
  'Venue',
  tests.uuid_organizer(),
  'MATCHJOIN30',
  false
);

insert into public.match_attendees (match_id, player_id, status, paid)
values ('b0000000-0000-4000-8000-000000000030'::uuid, tests.uuid_participant(), 'going', false);

insert into public.match_team_players (match_id, player_id, team)
values ('b0000000-0000-4000-8000-000000000030'::uuid, tests.uuid_participant(), 'A'::public.team_side);

-- Participant can read lineup
select tests.authenticate_as(tests.uuid_participant());
select isnt_empty(
  $$ select 1 from public.match_team_players
     where match_id = 'b0000000-0000-4000-8000-000000000030'::uuid $$,
  'participant reads team players'
);

select throws_ok(
  $$ insert into public.match_team_players (match_id, player_id, team)
     values ('b0000000-0000-4000-8000-000000000030'::uuid, tests.uuid_non_member(), 'B'::public.team_side) $$,
  '42501'
);

-- Organizer writes
select tests.authenticate_as(tests.uuid_organizer());
select lives_ok(
  $$ insert into public.match_team_players (match_id, player_id, team)
     values ('b0000000-0000-4000-8000-000000000030'::uuid, tests.uuid_organizer(), 'B'::public.team_side) $$,
  'organizer inserts team row'
);

select lives_ok(
  $$ delete from public.match_team_players
     where match_id = 'b0000000-0000-4000-8000-000000000030'::uuid
       and player_id = tests.uuid_organizer() $$,
  'organizer deletes team row'
);

-- Non-member
select tests.authenticate_as(tests.uuid_non_member());
select is_empty(
  $$ select 1 from public.match_team_players
     where match_id = 'b0000000-0000-4000-8000-000000000030'::uuid $$,
  'non_member cannot read lineup'
);

select tests.authenticate_anon();
select throws_ok($$ select 1 from public.match_team_players limit 1 $$, '42501');

select * from finish();

rollback;
