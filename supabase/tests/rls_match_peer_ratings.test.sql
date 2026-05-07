begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_participant());
select tests.create_user(tests.uuid_non_member());

insert into public.matches (id, starts_at, venue, organizer_id, join_code, status, score_a, score_b)
values (
  'b0000000-0000-4000-8000-000000000020'::uuid,
  now() - interval '1 day',
  'Saha',
  tests.uuid_organizer(),
  'RATEPEER20',
  'finished',
  1,
  0
);

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('b0000000-0000-4000-8000-000000000020'::uuid, tests.uuid_organizer(), 'going', false),
  ('b0000000-0000-4000-8000-000000000020'::uuid, tests.uuid_participant(), 'going', false);

insert into public.match_team_players (match_id, player_id, team)
values
  ('b0000000-0000-4000-8000-000000000020'::uuid, tests.uuid_organizer(), 'A'),
  ('b0000000-0000-4000-8000-000000000020'::uuid, tests.uuid_participant(), 'B');

-- Direct insert denied (no policy)
select tests.authenticate_as(tests.uuid_participant());
select throws_ok(
  $$ insert into public.match_peer_ratings (match_id, rater_id, ratee_id, score)
     values (
       'b0000000-0000-4000-8000-000000000020'::uuid,
       tests.uuid_participant(),
       tests.uuid_organizer(),
       7
     ) $$,
  '42501'
);

-- Cannot read other rater rows
select tests.reset_session();
select tests.authenticate_as(tests.uuid_organizer());
select is_empty(
  $$ select 1 from public.match_peer_ratings
     where match_id = 'b0000000-0000-4000-8000-000000000020'::uuid
       and rater_id = tests.uuid_participant() $$,
  'organizer cannot select peer ratings by another rater'
);

select tests.reset_session();
select tests.authenticate_as(tests.uuid_participant());

select lives_ok(
  $$ select public.upsert_match_peer_ratings(
       'b0000000-0000-4000-8000-000000000020'::uuid,
       jsonb_build_array(
         jsonb_build_object(
           'ratee_id', tests.uuid_organizer()::text,
           'score', 8
         )
       )
     ) $$,
  'participant upserts peer ratings'
);

select isnt_empty(
  $$ select 1 from public.match_peer_ratings r
     where r.match_id = 'b0000000-0000-4000-8000-000000000020'::uuid
       and r.rater_id = tests.uuid_participant()
       and r.ratee_id = tests.uuid_organizer()
       and r.score = 8 $$,
  'participant selects own rating row'
);

select lives_ok(
  $$ select public.upsert_match_motm_vote(
       'b0000000-0000-4000-8000-000000000020'::uuid,
       tests.uuid_organizer()
     ) $$,
  'participant submits MOTM'
);

select throws_ok(
  $$ select public.upsert_match_peer_ratings(
       'b0000000-0000-4000-8000-000000000020'::uuid,
       jsonb_build_array(
         jsonb_build_object('ratee_id', tests.uuid_participant()::text, 'score', 10)
       )
     ) $$,
  'P0001'
);

-- Upcoming match: cannot rate
select tests.reset_session();
insert into public.matches (id, starts_at, venue, organizer_id, join_code, status)
values (
  'b0000000-0000-4000-8000-000000000021'::uuid,
  now() + interval '1 day',
  'Later',
  tests.uuid_organizer(),
  'RATEUPCOM21',
  'upcoming'
);

insert into public.match_team_players (match_id, player_id, team)
values
  ('b0000000-0000-4000-8000-000000000021'::uuid, tests.uuid_organizer(), 'A'),
  ('b0000000-0000-4000-8000-000000000021'::uuid, tests.uuid_participant(), 'A');

select tests.authenticate_as(tests.uuid_participant());

select throws_ok(
  $$ select public.upsert_match_peer_ratings(
       'b0000000-0000-4000-8000-000000000021'::uuid,
       jsonb_build_array(
         jsonb_build_object('ratee_id', tests.uuid_organizer()::text, 'score', 5)
       )
     ) $$,
  'P0001'
);

-- Summary visible to participant
select is(
  (select (public.get_match_rating_public_summary('b0000000-0000-4000-8000-000000000020'::uuid) -> 'players' -> 0 ->> 'votes_count')::int),
  1,
  'organizer received one peer vote in summary'
);

select is(
  (select (public.get_match_rating_public_summary('b0000000-0000-4000-8000-000000000020'::uuid) -> 'motm' -> 0 ->> 'votes')::int),
  1,
  'MOTM tally in summary'
);

-- Outsider: no summary
select tests.reset_session();
select tests.authenticate_as(tests.uuid_non_member());
select is(
  public.get_match_rating_public_summary('b0000000-0000-4000-8000-000000000020'::uuid),
  null::jsonb,
  'non_member gets null summary'
);

select * from finish();

rollback;
