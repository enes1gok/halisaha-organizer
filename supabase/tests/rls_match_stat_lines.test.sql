begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_participant());

insert into public.matches (id, starts_at, venue, organizer_id, join_code)
values (
  'b0000000-0000-4000-8000-000000000040'::uuid,
  now() + interval '1 day',
  'Venue',
  tests.uuid_organizer(),
  'MATCHJOIN40'
);

insert into public.match_attendees (match_id, player_id, status, paid)
values ('b0000000-0000-4000-8000-000000000040'::uuid, tests.uuid_participant(), 'going', false);

insert into public.match_stat_lines (match_id, player_id, kind, count)
values (
  'b0000000-0000-4000-8000-000000000040'::uuid,
  tests.uuid_participant(),
  'goal'::public.stat_line_kind,
  1
);

select tests.authenticate_as(tests.uuid_participant());
select isnt_empty(
  $$ select 1 from public.match_stat_lines
     where match_id = 'b0000000-0000-4000-8000-000000000040'::uuid $$,
  'participant can read stat lines for visible match'
);

select throws_ok(
  $$ insert into public.match_stat_lines (match_id, player_id, kind, count)
     values ('b0000000-0000-4000-8000-000000000040'::uuid, tests.uuid_participant(), 'assist'::public.stat_line_kind, 1) $$,
  '42501'
);

select tests.authenticate_as(tests.uuid_organizer());
select lives_ok(
  $$ insert into public.match_stat_lines (match_id, player_id, kind, count)
     values ('b0000000-0000-4000-8000-000000000040'::uuid, tests.uuid_organizer(), 'assist'::public.stat_line_kind, 2) $$,
  'organizer inserts stat line'
);

select lives_ok(
  $$ update public.match_stat_lines set count = 3
     where match_id = 'b0000000-0000-4000-8000-000000000040'::uuid
       and player_id = tests.uuid_organizer()
       and kind = 'assist'::public.stat_line_kind $$,
  'organizer updates stat line'
);

select lives_ok(
  $$ delete from public.match_stat_lines
     where match_id = 'b0000000-0000-4000-8000-000000000040'::uuid
       and player_id = tests.uuid_organizer()
       and kind = 'assist'::public.stat_line_kind $$,
  'organizer deletes stat line'
);

select tests.authenticate_anon();
select throws_ok($$ select 1 from public.match_stat_lines limit 1 $$, '42501');

select * from finish();

rollback;
