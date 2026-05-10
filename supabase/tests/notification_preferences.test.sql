-- notification_preferences column + notification_delivery_allowed + enqueue filtering.

begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

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

select is(
  public.notification_delivery_allowed('{}'::jsonb, 'payment_reminder'),
  true,
  'empty prefs allow payment_reminder'
);

select is(
  public.notification_delivery_allowed(
    '{"types": {"group_match_payment_reminder": false}}'::jsonb,
    'payment_reminder'
  ),
  false,
  'group_match_payment_reminder false blocks payment_reminder'
);

select is(
  public.notification_delivery_allowed('{}'::jsonb, 'post_match_rating_reminder'),
  true,
  'empty prefs allow post_match_rating_reminder'
);

select is(
  public.notification_delivery_allowed(
    '{"types": {"group_match_post_match_rating_reminder": false}}'::jsonb,
    'post_match_rating_reminder'
  ),
  false,
  'group_match_post_match_rating_reminder false blocks post_match_rating_reminder'
);

select is(
  public.notification_delivery_allowed('{}'::jsonb, 'match_cancelled'),
  true,
  'empty prefs allow match_cancelled'
);

select is(
  public.notification_delivery_allowed(
    '{"types": {"group_match_cancelled": false}}'::jsonb,
    'match_cancelled'
  ),
  false,
  'group_match_cancelled false blocks match_cancelled'
);

select is(
  public.notification_delivery_allowed('{}'::jsonb, 'venue_change'),
  true,
  'empty prefs allow venue_change'
);

select is(
  public.notification_delivery_allowed(
    '{"types": {"group_match_venue_change": false}}'::jsonb,
    'venue_change'
  ),
  false,
  'group_match_venue_change false blocks venue_change'
);

select is(
  public.notification_delivery_allowed('{}'::jsonb, 'lineup_published'),
  true,
  'empty prefs allow lineup_published'
);

select is(
  public.notification_delivery_allowed(
    '{"types": {"group_match_lineup_published": false}}'::jsonb,
    'lineup_published'
  ),
  false,
  'group_match_lineup_published false blocks lineup_published'
);

select is(
  public.notification_delivery_allowed('{}'::jsonb, 'match_result'),
  true,
  'empty prefs allow match_result'
);

select is(
  public.notification_delivery_allowed(
    '{"types": {"group_match_match_result": false}}'::jsonb,
    'match_result'
  ),
  false,
  'group_match_match_result false blocks match_result'
);

select is(
  public.notification_delivery_allowed('{}'::jsonb, 'streak_at_risk'),
  true,
  'empty prefs allow streak_at_risk'
);

select is(
  public.notification_delivery_allowed(
    '{"types": {"group_match_streak_at_risk": false}}'::jsonb,
    'streak_at_risk'
  ),
  false,
  'group_match_streak_at_risk false blocks streak_at_risk'
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

update public.profiles
set notification_preferences = '{"types": {"group_match_payment_reminder": false}}'::jsonb
where id = 'a0000000-0000-4000-8000-000000000022'::uuid;

update public.profiles
set notification_preferences = '{"types": {"group_match_initial": false, "group_match_post_match_rating_reminder": false}}'::jsonb
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

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('b0000000-0000-4000-8000-000000000090'::uuid, 'a0000000-0000-4000-8000-000000000020'::uuid, 'going', false),
  ('b0000000-0000-4000-8000-000000000090'::uuid, 'a0000000-0000-4000-8000-000000000021'::uuid, 'going', false),
  ('b0000000-0000-4000-8000-000000000090'::uuid, 'a0000000-0000-4000-8000-000000000022'::uuid, 'going', false);

update public.matches
set starts_at = now() + interval '6 hours'
where id = 'b0000000-0000-4000-8000-000000000090'::uuid;

select public.enqueue_group_match_reminders();

select is(
  (select count(*)::int from public.notification_deliveries
   where match_id = 'b0000000-0000-4000-8000-000000000090'::uuid
     and type = 'payment_reminder'),
  1,
  'payment_reminder enqueue skips opted-out member'
);

update public.matches
set status = 'finished'::public.match_status
where id = 'b0000000-0000-4000-8000-000000000090'::uuid;

select is(
  (select count(*)::int from public.notification_deliveries
   where match_id = 'b0000000-0000-4000-8000-000000000090'::uuid
     and type = 'post_match_rating_reminder'),
  1,
  'post_match_rating_reminder enqueue skips opted-out member'
);

select * from finish();

rollback;
