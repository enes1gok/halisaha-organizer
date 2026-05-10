begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_participant());

insert into public.groups (id, name, owner_id, join_code)
values (
  'c0000000-0000-4000-8000-000000000031'::uuid,
  'Group Ret',
  tests.uuid_organizer(),
  'GRPCODE31'
);

insert into public.matches (id, starts_at, venue, organizer_id, join_code, group_id)
values (
  'b0000000-0000-4000-8000-000000000061'::uuid,
  now() + interval '1 day',
  'Venue',
  tests.uuid_organizer(),
  'MATCH61',
  'c0000000-0000-4000-8000-000000000031'::uuid
);

-- Old terminal row: eligible for purge when retention < age.
insert into public.notification_deliveries (
  match_id,
  group_id,
  recipient_id,
  token,
  type,
  status,
  created_at
)
values (
  'b0000000-0000-4000-8000-000000000061'::uuid,
  'c0000000-0000-4000-8000-000000000031'::uuid,
  tests.uuid_participant(),
  'tok-purge-old',
  'initial',
  'sent',
  now() - interval '120 days'
);

-- Old pending row: must never be purged by retention.
insert into public.notification_deliveries (
  match_id,
  group_id,
  recipient_id,
  token,
  type,
  status,
  created_at
)
values (
  'b0000000-0000-4000-8000-000000000061'::uuid,
  'c0000000-0000-4000-8000-000000000031'::uuid,
  tests.uuid_participant(),
  'tok-purge-pending',
  'initial',
  'pending',
  now() - interval '120 days'
);

select is(
  public.purge_old_notification_deliveries(30, 10000),
  1::bigint,
  'purge removes one old sent row (retention 30d)'
);

select is_empty(
  $$ select 1 from public.notification_deliveries where token = 'tok-purge-old' $$,
  'old sent delivery row deleted'
);

select isnt_empty(
  $$ select 1 from public.notification_deliveries where token = 'tok-purge-pending' and status = 'pending' $$,
  'old pending delivery row preserved'
);

select is(
  public.purge_old_notification_deliveries(200, 10000),
  0::bigint,
  'second purge is idempotent when nothing qualifies'
);

select * from finish();

rollback;
