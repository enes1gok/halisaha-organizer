begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_participant());
select tests.create_user(tests.uuid_non_member());

insert into public.matches (id, starts_at, venue, organizer_id, join_code, lineup_locked)
values (
  'b0000000-0000-4000-8000-000000000040'::uuid,
  now() - interval '2 hours',
  'Saha',
  tests.uuid_organizer(),
  'SCORELINE40',
  false
);

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('b0000000-0000-4000-8000-000000000040'::uuid, tests.uuid_participant(), 'going', false),
  ('b0000000-0000-4000-8000-000000000040'::uuid, tests.uuid_organizer(), 'going', false);

insert into public.match_team_players (match_id, player_id, team)
values
  ('b0000000-0000-4000-8000-000000000040'::uuid, tests.uuid_organizer(), 'A'::public.team_side),
  ('b0000000-0000-4000-8000-000000000040'::uuid, tests.uuid_participant(), 'B'::public.team_side);

update public.matches
set lineup_locked = true
where id = 'b0000000-0000-4000-8000-000000000040'::uuid;

-- Participant on lineup can submit
select tests.authenticate_as(tests.uuid_participant());

select lives_ok(
  $$ select public.submit_match_result(
       'b0000000-0000-4000-8000-000000000040'::uuid,
       3,
       1,
       '[{"player_id":"a0000000-0000-4000-8000-000000000001","count":2}]'::jsonb,
       '[]'::jsonb
     ) $$,
  'lineup player may submit score'
);

select is(
  (select status::text from public.matches where id = 'b0000000-0000-4000-8000-000000000040'::uuid),
  'finished',
  'match finished after participant submit'
);

-- Non-member cannot
select tests.authenticate_as(tests.uuid_non_member());

select throws_ok(
  $$ select public.submit_match_result(
       'b0000000-0000-4000-8000-000000000040'::uuid,
       0,
       0,
       '[]'::jsonb,
       '[]'::jsonb
     ) $$
);

select * from finish();

rollback;
