-- Context-aware notification routing contracts.

begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select tests.reset_session();

select tests.create_user('a0000000-0000-4000-8000-000000000031'::uuid);
select tests.create_user('a0000000-0000-4000-8000-000000000032'::uuid);

insert into public.notification_presence (user_id, app_state, last_seen_at)
values
  ('a0000000-0000-4000-8000-000000000031'::uuid, 'foreground', now() - interval '30 seconds'),
  ('a0000000-0000-4000-8000-000000000032'::uuid, 'foreground', now() - interval '5 minutes');

select is(
  public.is_user_active_in_app('a0000000-0000-4000-8000-000000000031'::uuid),
  true,
  'foreground heartbeat newer than stale window is active'
);

select is(
  public.is_user_active_in_app('a0000000-0000-4000-8000-000000000032'::uuid),
  false,
  'foreground heartbeat older than stale window is stale'
);

update public.notification_presence
set app_state = 'background',
    last_seen_at = now()
where user_id = 'a0000000-0000-4000-8000-000000000031'::uuid;

select is(
  public.is_user_active_in_app('a0000000-0000-4000-8000-000000000031'::uuid),
  false,
  'background state is never active'
);

insert into public.groups (id, name, owner_id, join_code)
values (
  'c0000000-0000-4000-8000-000000000071'::uuid,
  'Context Group',
  'a0000000-0000-4000-8000-000000000031'::uuid,
  'GRPCTX71'
);

insert into public.matches (id, starts_at, venue, organizer_id, join_code, group_id, max_players, status)
values (
  'b0000000-0000-4000-8000-000000000071'::uuid,
  now() + interval '4 hours',
  'Saha X',
  'a0000000-0000-4000-8000-000000000031'::uuid,
  'MATCHCTX71',
  'c0000000-0000-4000-8000-000000000071'::uuid,
  10,
  'upcoming'
);

insert into public.notification_deliveries
  (match_id, group_id, recipient_id, token, type, status)
values (
  'b0000000-0000-4000-8000-000000000071'::uuid,
  'c0000000-0000-4000-8000-000000000071'::uuid,
  'a0000000-0000-4000-8000-000000000032'::uuid,
  'tok-context',
  'initial',
  'in_app'
);

select is(
  (select status from public.notification_deliveries where token = 'tok-context'),
  'in_app',
  'notification_deliveries accepts in_app status for routed banners'
);

select is(
  (select count(*)::int from public.notification_deliveries where status = 'in_app'),
  1,
  'in_app status is queryable for client banner polling'
);

select is(
  public.notification_delivery_allowed('{}'::jsonb, 'initial'),
  true,
  'context-aware policy keeps existing preference gate semantics'
);

select is(
  public.notification_delivery_allowed('{"push_enabled": false}'::jsonb, 'initial'),
  false,
  'push_enabled false still blocks initial delivery'
);

select * from finish();

rollback;
