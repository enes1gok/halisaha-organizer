-- Weekly match streak + streak_at_risk enqueue (20260611120000_weekly_match_streak.sql).

begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

select tests.reset_session();

-- ---------------------------------------------------------------------------
-- Preferences mirror (streak_at_risk)
-- ---------------------------------------------------------------------------

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
-- Enqueue fixtures (users 030 / 031, group 070)
-- ---------------------------------------------------------------------------

select tests.create_user('a0000000-0000-4000-8000-000000000030'::uuid);
select tests.create_user('a0000000-0000-4000-8000-000000000031'::uuid);

insert into public.groups (id, name, owner_id, join_code)
values (
  'c0000000-0000-4000-8000-000000000070'::uuid,
  'Streak Group',
  'a0000000-0000-4000-8000-000000000031'::uuid,
  'GRPSTRK70'
);

insert into public.group_members (group_id, player_id, role)
values
  ('c0000000-0000-4000-8000-000000000070'::uuid, 'a0000000-0000-4000-8000-000000000031'::uuid, 'owner'),
  ('c0000000-0000-4000-8000-000000000070'::uuid, 'a0000000-0000-4000-8000-000000000030'::uuid, 'member');

insert into public.push_tokens (user_id, token, platform, is_active)
values ('a0000000-0000-4000-8000-000000000030'::uuid, 'tok-streak-30', 'ios', true);

update public.profiles
set
  weekly_match_streak_weeks = 2,
  weekly_match_last_qualifying_week_start = '2026-06-01'::date
where id = 'a0000000-0000-4000-8000-000000000030'::uuid;

-- Wednesday 2026-06-10 TR — no matches in group → enqueue one delivery per token
select is(
  public.enqueue_streak_at_risk_reminders('2026-06-10 16:00:00+03'::timestamptz),
  1,
  'enqueue inserts one streak_at_risk row for single active token'
);

select is(
  (
    select count(*)::int
    from public.notification_deliveries
    where recipient_id = 'a0000000-0000-4000-8000-000000000030'::uuid
      and type = 'streak_at_risk'
  ),
  1,
  'streak_at_risk row exists'
);

select is(
  public.enqueue_streak_at_risk_reminders('2026-06-10 17:00:00+03'::timestamptz),
  0,
  'second enqueue same Wednesday dedupes to zero new rows'
);

-- Tuesday → no enqueue (wrong weekday)
delete from public.notification_deliveries
where recipient_id = 'a0000000-0000-4000-8000-000000000030'::uuid;

select is(
  public.enqueue_streak_at_risk_reminders('2026-06-09 16:00:00+03'::timestamptz),
  0,
  'enqueue returns 0 when Istanbul day is not Wednesday'
);

-- Upcoming match this ISO week blocks risk notification
insert into public.matches (
  id,
  starts_at,
  venue,
  organizer_id,
  join_code,
  group_id,
  max_players,
  status
)
values (
  'b0000000-0000-4000-8000-000000000088'::uuid,
  '2026-06-11 20:00:00+03'::timestamptz,
  'Block saha',
  'a0000000-0000-4000-8000-000000000031'::uuid,
  'STRBLK88',
  'c0000000-0000-4000-8000-000000000070'::uuid,
  10,
  'upcoming'
);

delete from public.notification_deliveries
where recipient_id = 'a0000000-0000-4000-8000-000000000030'::uuid;

select is(
  public.enqueue_streak_at_risk_reminders('2026-06-10 16:00:00+03'::timestamptz),
  0,
  'upcoming match this week in member group blocks enqueue'
);

select is_empty(
  $$ select 1 from public.notification_deliveries
     where recipient_id = 'a0000000-0000-4000-8000-000000000030'::uuid
       and type = 'streak_at_risk' $$,
  'no streak_at_risk row when upcoming exists'
);

-- Preference opt-out
delete from public.matches where id = 'b0000000-0000-4000-8000-000000000088'::uuid;

update public.profiles
set notification_preferences = '{"types": {"group_match_streak_at_risk": false}}'::jsonb
where id = 'a0000000-0000-4000-8000-000000000030'::uuid;

select is(
  public.enqueue_streak_at_risk_reminders('2026-06-10 16:00:00+03'::timestamptz),
  0,
  'prefs opt-out yields zero inserts'
);

-- ---------------------------------------------------------------------------
-- Finished match updates streak (users 040 / 041, group 071)
-- ---------------------------------------------------------------------------

select tests.create_user('a0000000-0000-4000-8000-000000000040'::uuid);
select tests.create_user('a0000000-0000-4000-8000-000000000041'::uuid);

insert into public.groups (id, name, owner_id, join_code)
values (
  'c0000000-0000-4000-8000-000000000071'::uuid,
  'Streak Finish Group',
  'a0000000-0000-4000-8000-000000000041'::uuid,
  'GRPSTRK71'
);

insert into public.group_members (group_id, player_id, role)
values
  ('c0000000-0000-4000-8000-000000000071'::uuid, 'a0000000-0000-4000-8000-000000000041'::uuid, 'owner'),
  ('c0000000-0000-4000-8000-000000000071'::uuid, 'a0000000-0000-4000-8000-000000000040'::uuid, 'member');

insert into public.matches (
  id,
  starts_at,
  venue,
  organizer_id,
  join_code,
  group_id,
  max_players,
  status
)
values (
  'b0000000-0000-4000-8000-000000000099'::uuid,
  '2026-07-06 20:00:00+03'::timestamptz,
  'Seri saha',
  'a0000000-0000-4000-8000-000000000041'::uuid,
  'STRFIN99',
  'c0000000-0000-4000-8000-000000000071'::uuid,
  10,
  'upcoming'
);

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('b0000000-0000-4000-8000-000000000099'::uuid, 'a0000000-0000-4000-8000-000000000041'::uuid, 'going', false),
  ('b0000000-0000-4000-8000-000000000099'::uuid, 'a0000000-0000-4000-8000-000000000040'::uuid, 'going', false);

update public.matches
set
  status = 'finished'::public.match_status,
  score_a = 3,
  score_b = 2
where id = 'b0000000-0000-4000-8000-000000000099'::uuid;

select is(
  (
    select weekly_match_streak_weeks
    from public.profiles
    where id = 'a0000000-0000-4000-8000-000000000040'::uuid
  ),
  1,
  'first finished group match sets weekly streak to 1 for going attendee'
);

select is(
  (
    select weekly_match_last_qualifying_week_start
    from public.profiles
    where id = 'a0000000-0000-4000-8000-000000000040'::uuid
  ),
  public.week_monday_istanbul('2026-07-06 20:00:00+03'::timestamptz),
  'last qualifying week matches starts_at Monday (Istanbul)'
);

select * from finish();

rollback;
