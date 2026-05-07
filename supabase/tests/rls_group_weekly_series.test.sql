begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_participant());
select tests.create_user(tests.uuid_non_member());

insert into public.groups (id, name, owner_id, join_code)
values (
  'd0000000-0000-4000-8000-000000000020'::uuid,
  'Weekly RLS',
  tests.uuid_organizer(),
  'WEEKGRP20'
);

insert into public.group_members (group_id, player_id, role)
values
  ('d0000000-0000-4000-8000-000000000020'::uuid, tests.uuid_organizer(), 'owner'),
  ('d0000000-0000-4000-8000-000000000020'::uuid, tests.uuid_participant(), 'member');

-- Member can read series row
insert into public.group_weekly_series (
  group_id,
  is_active,
  weekday_isodow,
  local_time,
  timezone,
  venue,
  max_players,
  default_organizer_id
)
values (
  'd0000000-0000-4000-8000-000000000020'::uuid,
  true,
  3,
  '20:00'::time,
  'Europe/Istanbul',
  'Saha',
  14,
  tests.uuid_organizer()
);

select tests.authenticate_as(tests.uuid_participant());

select isnt_empty(
  $$ select id from public.group_weekly_series
     where group_id = 'd0000000-0000-4000-8000-000000000020'::uuid $$,
  'member selects weekly series'
);

-- Member cannot insert
select throws_ok(
  $$ insert into public.group_weekly_series (
       group_id, is_active, weekday_isodow, local_time, venue, max_players, default_organizer_id
     ) values (
       'd0000000-0000-4000-8000-000000000020'::uuid,
       true, 4, '19:00'::time, 'X', 14, tests.uuid_participant()
     ) $$,
  '42501'
);

-- Owner upserts
select tests.authenticate_as(tests.uuid_organizer());

select lives_ok(
  $$ insert into public.group_weekly_series (
       group_id, is_active, weekday_isodow, local_time, venue, max_players, default_organizer_id
     ) values (
       'd0000000-0000-4000-8000-000000000020'::uuid,
       true, 5, '21:30'::time, 'Saha 2', 12, tests.uuid_organizer()
     )
     on conflict (group_id) do update set
       weekday_isodow = excluded.weekday_isodow,
       local_time = excluded.local_time,
       venue = excluded.venue,
       max_players = excluded.max_players $$,
  'owner upserts series on conflict'
);

select is(
  (
    select weekday_isodow::int
    from public.group_weekly_series
    where
      group_id = 'd0000000-0000-4000-8000-000000000020'::uuid
  ),
  5,
  'series weekday updated'
);

select tests.authenticate_as(tests.uuid_non_member());

select is_empty(
  $$ select id from public.group_weekly_series
     where group_id = 'd0000000-0000-4000-8000-000000000020'::uuid $$,
  'outsider cannot select weekly series'
);

select tests.authenticate_as(tests.uuid_participant());

select isnt_empty(
  $$ select id from public.group_weekly_series
     where group_id = 'd0000000-0000-4000-8000-000000000020'::uuid $$,
  'member still sees series after owner update'
);

select * from finish();

rollback;
