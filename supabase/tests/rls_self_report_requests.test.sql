begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_participant());
select tests.create_user(tests.uuid_non_member());

insert into public.matches (id, starts_at, venue, organizer_id, join_code, self_report_enabled)
values (
  'b0000000-0000-4000-8000-000000000050'::uuid,
  now() + interval '1 day',
  'Venue',
  tests.uuid_organizer(),
  'MATCHJOIN50',
  true
);

insert into public.match_attendees (match_id, player_id, status, paid)
values ('b0000000-0000-4000-8000-000000000050'::uuid, tests.uuid_participant(), 'going', false);

-- Player insert when enabled + visible
select tests.authenticate_as(tests.uuid_participant());
select lives_ok(
  $$ insert into public.self_report_requests (match_id, player_id, type, status)
     values (
       'b0000000-0000-4000-8000-000000000050'::uuid,
       tests.uuid_participant(),
       'goal'::public.self_report_type,
       'pending'::public.self_report_status
     ) $$,
  'player inserts self report when enabled'
);

-- Cannot insert for another player
select throws_ok(
  $$ insert into public.self_report_requests (match_id, player_id, type, status)
     values (
       'b0000000-0000-4000-8000-000000000050'::uuid,
       tests.uuid_organizer(),
       'goal'::public.self_report_type,
       'pending'::public.self_report_status
     ) $$,
  '42501'
);

-- Self-report disabled
select tests.reset_session();
update public.matches set self_report_enabled = false where id = 'b0000000-0000-4000-8000-000000000050'::uuid;
select tests.authenticate_as(tests.uuid_participant());
select throws_ok(
  $$ insert into public.self_report_requests (match_id, player_id, type, status)
     values (
       'b0000000-0000-4000-8000-000000000050'::uuid,
       tests.uuid_participant(),
       'assist'::public.self_report_type,
       'pending'::public.self_report_status
     ) $$,
  '42501'
);

-- Organizer sees + updates + deletes
select tests.reset_session();
update public.matches set self_report_enabled = true where id = 'b0000000-0000-4000-8000-000000000050'::uuid;
select tests.authenticate_as(tests.uuid_organizer());
select isnt_empty(
  $$ select id from public.self_report_requests
     where match_id = 'b0000000-0000-4000-8000-000000000050'::uuid $$,
  'organizer selects self reports'
);

select lives_ok(
  $$ update public.self_report_requests
     set status = 'approved'::public.self_report_status
     where match_id = 'b0000000-0000-4000-8000-000000000050'::uuid $$,
  'organizer approves self report'
);

select lives_ok(
  $$ delete from public.self_report_requests
     where match_id = 'b0000000-0000-4000-8000-000000000050'::uuid $$,
  'organizer deletes self reports'
);

-- Player cannot update own pending (no policy)
select tests.reset_session();
insert into public.self_report_requests (id, match_id, player_id, type, status)
values (
  gen_random_uuid(),
  'b0000000-0000-4000-8000-000000000050'::uuid,
  tests.uuid_participant(),
  'goal'::public.self_report_type,
  'pending'::public.self_report_status
);
select tests.authenticate_as(tests.uuid_participant());
update public.self_report_requests
set status = 'approved'::public.self_report_status
where match_id = 'b0000000-0000-4000-8000-000000000050'::uuid
  and player_id = tests.uuid_participant();
select is(
  (select status::text from public.self_report_requests
   where match_id = 'b0000000-0000-4000-8000-000000000050'::uuid
     and player_id = tests.uuid_participant()),
  'pending',
  'player update self report has no policy path'
);

-- Non-member cannot read
select tests.authenticate_as(tests.uuid_non_member());
select is_empty(
  $$ select 1 from public.self_report_requests
     where match_id = 'b0000000-0000-4000-8000-000000000050'::uuid $$,
  'non_member cannot select self reports'
);

select tests.authenticate_anon();
select is_empty(
  $$ select 1 from public.self_report_requests limit 1 $$,
  'anon cannot see self_report_requests rows'
);

select * from finish();

rollback;
