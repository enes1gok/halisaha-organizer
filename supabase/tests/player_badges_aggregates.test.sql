begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_participant());

insert into public.matches (id, starts_at, venue, organizer_id, join_code, lineup_locked)
values (
  'd0000000-0000-4000-8000-000000000042'::uuid,
  now() - interval '2 hours',
  'Rozet test',
  tests.uuid_organizer(),
  'BADGEAGG42',
  false
);

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('d0000000-0000-4000-8000-000000000042'::uuid, tests.uuid_participant(), 'going', false),
  ('d0000000-0000-4000-8000-000000000042'::uuid, tests.uuid_organizer(), 'going', false);

insert into public.match_team_players (match_id, player_id, team)
values
  ('d0000000-0000-4000-8000-000000000042'::uuid, tests.uuid_organizer(), 'A'::public.team_side),
  ('d0000000-0000-4000-8000-000000000042'::uuid, tests.uuid_participant(), 'B'::public.team_side);

update public.matches
set lineup_locked = true
where id = 'd0000000-0000-4000-8000-000000000042'::uuid;

select tests.authenticate_as(tests.uuid_participant());

select lives_ok(
  $$ select public.submit_match_result(
       'd0000000-0000-4000-8000-000000000042'::uuid,
       2,
       1,
       '[{"player_id":"a0000000-0000-4000-8000-000000000002","count":2}]'::jsonb,
       '[]'::jsonb,
       '[]'::jsonb
     ) $$,
  'submit_match_result updates badge aggregates'
);

-- player_rating_aggregates: RLS without client SELECT — read as privileged session (see rls_rating_aggregates.test.sql).
select tests.reset_session();

select is(
  (select career_goals from public.player_rating_aggregates where player_id = tests.uuid_participant()),
  2,
  'career_goals reflects scorer stat lines'
);

select is(
  (select finished_matches_played from public.player_rating_aggregates where player_id = tests.uuid_participant()),
  1,
  'finished_matches_played increments once'
);

select is(
  (select goal_match_streak_best from public.player_rating_aggregates where player_id = tests.uuid_participant()),
  1,
  'goal_match_streak_best after first scoring match'
);

select * from finish();

rollback;
