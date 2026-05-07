-- notification_preferences column + notification_delivery_allowed + enqueue filtering.

begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select tests.reset_session();

-- ---------------------------------------------------------------------------
-- Helpers (mirror server semantics)
-- ---------------------------------------------------------------------------

select is(
  public.notification_delivery_allowed('{}'::jsonb, 'initial'),
  true,
  'empty prefs allow initial'
);

select is(
  public.notification_delivery_allowed('{}'::jsonb, 'reminder'),
  true,
  'empty prefs allow reminder'
);

select is(
  public.notification_delivery_allowed('{"push_enabled": false}'::jsonb, 'initial'),
  false,
  'push_enabled false blocks initial'
);

select is(
  public.notification_delivery_allowed(
    '{"types": {"group_match_initial": false}}'::jsonb,
    'initial'
  ),
  false,
  'group_match_initial false blocks initial'
);

select is(
  public.notification_delivery_allowed(
    '{"types": {"group_match_initial": false}}'::jsonb,
    'reminder'
  ),
  true,
  'group_match_initial does not block reminder'
);

select is(
  public.notification_delivery_allowed(
    '{"types": {"group_match_reminder": false}}'::jsonb,
    'reminder'
  ),
  false,
  'group_match_reminder false blocks reminder'
);

-- ---------------------------------------------------------------------------
-- Integration: initial enqueue skips opted-out member
-- ---------------------------------------------------------------------------

select tests.create_user('a0000000-0000-4000-8000-000000000020'::uuid);
select tests.create_user('a0000000-0000-4000-8000-000000000021'::uuid);
select tests.create_user('a0000000-0000-4000-8000-000000000022'::uuid);

update public.profiles
set notification_preferences = '{"types": {"group_match_initial": false}}'::jsonb
where id = 'a0000000-0000-4000-8000-000000000021'::uuid;

insert into public.groups (id, name, owner_id, join_code)
values (
  'c0000000-0000-4000-8000-000000000060'::uuid,
  'Pref Group',
  'a0000000-0000-4000-8000-000000000020'::uuid,
  'GRPCREF60'
);

insert into public.group_members (group_id, player_id, role)
values
  ('c0000000-0000-4000-8000-000000000060'::uuid, 'a0000000-0000-4000-8000-000000000020'::uuid, 'owner'),
  ('c0000000-0000-4000-8000-000000000060'::uuid, 'a0000000-0000-4000-8000-000000000021'::uuid, 'member'),
  ('c0000000-0000-4000-8000-000000000060'::uuid, 'a0000000-0000-4000-8000-000000000022'::uuid, 'member');

insert into public.push_tokens (user_id, token, platform, is_active)
values
  ('a0000000-0000-4000-8000-000000000020'::uuid, 'tok-pref-org', 'ios', true),
  ('a0000000-0000-4000-8000-000000000021'::uuid, 'tok-pref-a', 'ios', true),
  ('a0000000-0000-4000-8000-000000000022'::uuid, 'tok-pref-b', 'ios', true);

insert into public.matches (id, starts_at, venue, organizer_id, join_code, group_id, max_players, status)
values (
  'b0000000-0000-4000-8000-000000000090'::uuid,
  now() + interval '2 days',
  'Saha P',
  'a0000000-0000-4000-8000-000000000020'::uuid,
  'MATCHPREF90',
  'c0000000-0000-4000-8000-000000000060'::uuid,
  10,
  'upcoming'
);

select is(
  (select count(*)::int from public.notification_deliveries
   where match_id = 'b0000000-0000-4000-8000-000000000090'::uuid
     and type = 'initial'),
  1,
  'initial broadcast skips member who disabled group_match_initial (one non-organizer member)'
);

select isnt_empty(
  $$ select 1 from public.claim_pending_deliveries(10)
     where recipient_id is not null
       and delivery_id is not null $$,
  'claim_pending_deliveries returns recipient_id'
);

select * from finish();

rollback;
