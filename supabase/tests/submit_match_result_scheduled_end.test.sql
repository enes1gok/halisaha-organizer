begin;

create extension if not exists pgtap with schema extensions;

select plan(2);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_participant());

insert into public.matches (id, starts_at, venue, organizer_id, join_code, lineup_locked)
values (
  'c0000000-0000-4000-8000-000000000041'::uuid,
  now() + interval '30 minutes',
  'Erken skor',
  tests.uuid_organizer(),
  'EARLYSCORE',
  false
);

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('c0000000-0000-4000-8000-000000000041'::uuid, tests.uuid_participant(), 'going', false),
  ('c0000000-0000-4000-8000-000000000041'::uuid, tests.uuid_organizer(), 'going', false);

insert into public.match_team_players (match_id, player_id, team)
values
  ('c0000000-0000-4000-8000-000000000041'::uuid, tests.uuid_organizer(), 'A'::public.team_side),
  ('c0000000-0000-4000-8000-000000000041'::uuid, tests.uuid_participant(), 'B'::public.team_side);

update public.matches
set lineup_locked = true
where id = 'c0000000-0000-4000-8000-000000000041'::uuid;

select tests.authenticate_as(tests.uuid_participant());

select throws_ok(
  $$ select public.submit_match_result(
       'c0000000-0000-4000-8000-000000000041'::uuid,
       1,
       1,
       '[]'::jsonb,
       '[]'::jsonb
     ) $$,
  'P0001',
  'ERR_MATCH_SCORE_BEFORE_END',
  'submit blocked before scheduled match end'
);

update public.matches
set starts_at = now() - interval '2 hours'
where id = 'c0000000-0000-4000-8000-000000000041'::uuid;

select lives_ok(
  $$ select public.submit_match_result(
       'c0000000-0000-4000-8000-000000000041'::uuid,
       2,
       2,
       '[]'::jsonb,
       '[]'::jsonb
     ) $$,
  'submit ok after starts_at + 60 min window'
);

select * from finish();

rollback;
