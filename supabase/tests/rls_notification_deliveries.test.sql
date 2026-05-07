begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_participant());

insert into public.groups (id, name, owner_id, join_code)
values (
  'c0000000-0000-4000-8000-000000000030'::uuid,
  'Group C',
  tests.uuid_organizer(),
  'GRPCODE30'
);

insert into public.matches (id, starts_at, venue, organizer_id, join_code, group_id)
values (
  'b0000000-0000-4000-8000-000000000060'::uuid,
  now() + interval '1 day',
  'Venue',
  tests.uuid_organizer(),
  'MATCH60',
  'c0000000-0000-4000-8000-000000000030'::uuid
);

insert into public.notification_deliveries (match_id, group_id, recipient_id, token, status)
values (
  'b0000000-0000-4000-8000-000000000060'::uuid,
  'c0000000-0000-4000-8000-000000000030'::uuid,
  tests.uuid_participant(),
  'push-tok-x',
  'pending'
);

select tests.authenticate_as(tests.uuid_participant());
select isnt_empty(
  $$ select 1 from public.notification_deliveries
     where recipient_id = tests.uuid_participant() $$,
  'recipient reads own notification row'
);

select tests.authenticate_as(tests.uuid_organizer());
select is_empty(
  $$ select 1 from public.notification_deliveries
     where recipient_id = tests.uuid_participant() $$,
  'organizer cannot read delivery for another recipient'
);

select throws_ok(
  $$ insert into public.notification_deliveries (match_id, group_id, recipient_id, token, status)
     values (
       'b0000000-0000-4000-8000-000000000060'::uuid,
       'c0000000-0000-4000-8000-000000000030'::uuid,
       tests.uuid_organizer(),
       'x',
       'pending'
     ) $$,
  '42501'
);

select tests.authenticate_anon();
select is_empty(
  $$ select 1 from public.notification_deliveries limit 1 $$,
  'anon cannot see notification_deliveries rows'
);

select * from finish();

rollback;
