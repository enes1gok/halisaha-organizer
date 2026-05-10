begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_participant());
select tests.create_user(tests.uuid_non_member());
select tests.create_user(tests.uuid_group_extra());

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

-- Opposing lineup player can select + approve
select tests.reset_session();

insert into public.matches (id, starts_at, venue, organizer_id, join_code, self_report_enabled)
values (
  'c0000000-0000-4000-8000-000000000060'::uuid,
  now() + interval '1 day',
  'Venue',
  tests.uuid_organizer(),
  'MATCHJOIN60',
  true
);

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('c0000000-0000-4000-8000-000000000060'::uuid, tests.uuid_participant(), 'going', false),
  ('c0000000-0000-4000-8000-000000000060'::uuid, tests.uuid_group_extra(), 'going', false);

insert into public.match_team_players (match_id, player_id, team)
values
  ('c0000000-0000-4000-8000-000000000060'::uuid, tests.uuid_participant(), 'A'::public.team_side),
  ('c0000000-0000-4000-8000-000000000060'::uuid, tests.uuid_group_extra(), 'B'::public.team_side);

insert into public.self_report_requests (id, match_id, player_id, type, status)
values (
  gen_random_uuid(),
  'c0000000-0000-4000-8000-000000000060'::uuid,
  tests.uuid_participant(),
  'goal'::public.self_report_type,
  'pending'::public.self_report_status
);

select tests.authenticate_as(tests.uuid_group_extra());
select isnt_empty(
  $$ select id from public.self_report_requests
     where match_id = 'c0000000-0000-4000-8000-000000000060'::uuid $$,
  'opposing player selects peer self report'
);

select lives_ok(
  $$ update public.self_report_requests
     set status = 'approved'::public.self_report_status
     where match_id = 'c0000000-0000-4000-8000-000000000060'::uuid $$,
  'opposing player approves self report'
);

-- Same team (non-organizer) cannot see teammate draft
select tests.reset_session();

insert into public.matches (id, starts_at, venue, organizer_id, join_code, self_report_enabled)
values (
  'd0000000-0000-4000-8000-000000000070'::uuid,
  now() + interval '1 day',
  'Venue',
  tests.uuid_organizer(),
  'MATCHJOIN70',
  true
);

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('d0000000-0000-4000-8000-000000000070'::uuid, tests.uuid_participant(), 'going', false),
  ('d0000000-0000-4000-8000-000000000070'::uuid, tests.uuid_group_extra(), 'going', false);

insert into public.match_team_players (match_id, player_id, team)
values
  ('d0000000-0000-4000-8000-000000000070'::uuid, tests.uuid_participant(), 'A'::public.team_side),
  ('d0000000-0000-4000-8000-000000000070'::uuid, tests.uuid_group_extra(), 'A'::public.team_side);

insert into public.self_report_requests (id, match_id, player_id, type, status)
values (
  gen_random_uuid(),
  'd0000000-0000-4000-8000-000000000070'::uuid,
  tests.uuid_participant(),
  'goal'::public.self_report_type,
  'pending'::public.self_report_status
);

select tests.authenticate_as(tests.uuid_group_extra());
select is_empty(
  $$ select 1 from public.self_report_requests
     where match_id = 'd0000000-0000-4000-8000-000000000070'::uuid $$,
  'same-team teammate cannot select peer self report'
);

-- Organizer cannot self-approve when reporter is on lineup
select tests.reset_session();

insert into public.matches (id, starts_at, venue, organizer_id, join_code, self_report_enabled)
values (
  'f0000000-0000-4000-8000-000000000080'::uuid,
  now() + interval '1 day',
  'Venue',
  tests.uuid_organizer(),
  'MATCHJOIN80',
  true
);

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('f0000000-0000-4000-8000-000000000080'::uuid, tests.uuid_organizer(), 'going', false),
  ('f0000000-0000-4000-8000-000000000080'::uuid, tests.uuid_participant(), 'going', false);

insert into public.match_team_players (match_id, player_id, team)
values
  ('f0000000-0000-4000-8000-000000000080'::uuid, tests.uuid_organizer(), 'A'::public.team_side),
  ('f0000000-0000-4000-8000-000000000080'::uuid, tests.uuid_participant(), 'B'::public.team_side);

insert into public.self_report_requests (id, match_id, player_id, type, status)
values (
  gen_random_uuid(),
  'f0000000-0000-4000-8000-000000000080'::uuid,
  tests.uuid_organizer(),
  'goal'::public.self_report_type,
  'pending'::public.self_report_status
);

select tests.authenticate_as(tests.uuid_organizer());
update public.self_report_requests
set
  status = 'approved'::public.self_report_status
where
  match_id = 'f0000000-0000-4000-8000-000000000080'::uuid
  and player_id = tests.uuid_organizer();
select is(
  (
    select
      status::text
    from
      public.self_report_requests
    where
      match_id = 'f0000000-0000-4000-8000-000000000080'::uuid
      and player_id = tests.uuid_organizer()
  ),
  'pending',
  'organizer cannot self-approve when on lineup'
);

-- Approved after match finished syncs match_stat_lines
select tests.reset_session();

insert into public.matches (id, starts_at, venue, organizer_id, join_code, self_report_enabled, status, score_a, score_b)
values (
  'e0000000-0000-4000-8000-000000000090'::uuid,
  now() - interval '2 hours',
  'Venue',
  tests.uuid_organizer(),
  'MATCHJOIN90',
  true,
  'finished'::public.match_status,
  1,
  0
);

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('e0000000-0000-4000-8000-000000000090'::uuid, tests.uuid_participant(), 'going', false),
  ('e0000000-0000-4000-8000-000000000090'::uuid, tests.uuid_group_extra(), 'going', false);

insert into public.match_team_players (match_id, player_id, team)
values
  ('e0000000-0000-4000-8000-000000000090'::uuid, tests.uuid_participant(), 'A'::public.team_side),
  ('e0000000-0000-4000-8000-000000000090'::uuid, tests.uuid_group_extra(), 'B'::public.team_side);

insert into public.self_report_requests (id, match_id, player_id, type, status)
values (
  gen_random_uuid(),
  'e0000000-0000-4000-8000-000000000090'::uuid,
  tests.uuid_participant(),
  'goal'::public.self_report_type,
  'pending'::public.self_report_status
);

select tests.authenticate_as(tests.uuid_group_extra());
select lives_ok(
  $$ update public.self_report_requests
     set status = 'approved'::public.self_report_status
     where match_id = 'e0000000-0000-4000-8000-000000000090'::uuid $$,
  'opposing approves after match finished inserts stat line'
);

select tests.reset_session();
select is(
  (
    select
      count(*)::int
    from
      public.match_stat_lines
    where
      match_id = 'e0000000-0000-4000-8000-000000000090'::uuid
      and kind = 'goal'::public.stat_line_kind
      and player_id = tests.uuid_participant()
  ),
  1,
  'trigger adds goal stat line on late approve'
);

select * from finish();

rollback;
