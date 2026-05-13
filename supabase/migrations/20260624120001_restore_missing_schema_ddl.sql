-- Emergency: Restore missing schema DDL from migrations 20260611-20260619 that were recorded but not executed.
-- This restores: weekly_match_streak columns, profiles_public view with updated_at, and graph functions.

-- ─────────────────────────────────────────────────────────────────────────────
-- From 20260611: Weekly global match streak
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper: Monday (date) of the Istanbul local week for a timestamptz
create or replace function public.week_monday_istanbul(p_ts timestamptz)
returns date
language sql
immutable
parallel safe
set search_path = public
as $$
  select (date_trunc(
    'week',
    (p_ts at time zone 'Europe/Istanbul')
  ))::date;
$$;

comment on function public.week_monday_istanbul(timestamptz) is
  'ISO week start Monday in Europe/Istanbul local time for the instant p_ts.';

-- Add streak columns to profiles if they don't exist
alter table public.profiles
  add column if not exists weekly_match_streak_weeks integer not null default 0
    check (weekly_match_streak_weeks >= 0);

alter table public.profiles
  add column if not exists weekly_match_last_qualifying_week_start date null;

comment on column public.profiles.weekly_match_streak_weeks is
  'Ardışık hafta sayısı (grup maçı finished + going); hafta sınırı week_monday_istanbul(starts_at).';
comment on column public.profiles.weekly_match_last_qualifying_week_start is
  'Son haftanın Pazartesi tarihi (Istanbul) — streak güncellemesi için.';

-- Ensure notification_deliveries can be nullable for match_id (for streak_at_risk)
alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_match_group_ctx_chk;

alter table public.notification_deliveries
  alter column match_id drop not null;

alter table public.notification_deliveries
  add constraint notification_deliveries_match_group_ctx_chk
  check ((match_id is not null) or (group_id is not null));

comment on constraint notification_deliveries_match_group_ctx_chk
  on public.notification_deliveries is
  'Every notification row must have either match_id (direct) or group_id (for reminders/at-risk).';

-- ─────────────────────────────────────────────────────────────────────────────
-- From 20260619: Avatar cache busting + updated_at on profiles_public
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view public.profiles_public
with (security_invoker = false) as
select
  p.id,
  p.display_name,
  p.photo_uri,
  p.position,
  p.preferred_foot,
  p.weekly_match_streak_weeks,
  p.weekly_match_last_qualifying_week_start,
  case
    when p.weekly_match_streak_weeks <= 0
      or p.weekly_match_last_qualifying_week_start is null then 0
    when p.weekly_match_last_qualifying_week_start < (
      public.week_monday_istanbul(now()) - interval '7 days'
    )::date then 0
    else p.weekly_match_streak_weeks
  end as weekly_match_streak_effective_weeks,
  p.updated_at
from public.profiles p;

grant select on table public.profiles_public to authenticated;

comment on view public.profiles_public is
  'Non-sensitive profile fields + streak + updated_at for avatar cache busting; security_invoker=false.';

-- Recreate match_graph_row_body function with updated_at in profiles
create or replace function public.match_graph_row_body(p_match_id uuid)
returns table (
  id uuid,
  starts_at timestamptz,
  venue text,
  organizer_id uuid,
  max_players int,
  price_per_person numeric,
  iban text,
  iban_account_name text,
  payment_note text,
  payment_method text,
  join_code text,
  lineup_locked boolean,
  self_report_enabled boolean,
  status public.match_status,
  score_a int,
  score_b int,
  group_id uuid,
  series_id uuid,
  spawned_from_match_id uuid,
  attendees jsonb,
  team_players jsonb,
  stat_lines jsonb,
  self_reports jsonb,
  profiles jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with m as (
    select
      mt.id,
      mt.starts_at,
      mt.venue,
      mt.organizer_id,
      mt.max_players,
      mt.price_per_person,
      mt.iban,
      mt.join_code,
      mt.lineup_locked,
      mt.self_report_enabled,
      mt.status,
      mt.score_a,
      mt.score_b,
      mt.group_id,
      mt.series_id,
      mt.spawned_from_match_id,
      mt.payment_method::text,
      mt.iban_account_name,
      mt.payment_note
    from public.matches mt
    where mt.id = p_match_id
  ),
  att as (
    select
      a.match_id,
      a.player_id,
      a.status,
      a.paid
    from public.match_attendees a
    inner join m on m.id = a.match_id
  ),
  mtp as (
    select
      t.match_id,
      t.player_id,
      t.team
    from public.match_team_players t
    inner join m on m.id = t.match_id
  ),
  msl as (
    select
      s.match_id,
      s.player_id,
      s.kind,
      s.count
    from public.match_stat_lines s
    inner join m on m.id = s.match_id and m.status = 'finished'::public.match_status
  ),
  srr as (
    select
      sr.id,
      sr.match_id,
      sr.player_id,
      sr.type,
      sr.status
    from public.self_report_requests sr
    inner join m on m.id = sr.match_id
  ),
  profile_ids as (
    select m.organizer_id as player_id
    from m
    union
    select att.player_id
    from att
    union
    select mtp.player_id
    from mtp
    union
    select msl.player_id
    from msl
    union
    select srr.player_id
    from srr
  )
  select
    m.id,
    m.starts_at,
    m.venue,
    m.organizer_id,
    m.max_players,
    m.price_per_person,
    m.iban,
    m.iban_account_name,
    m.payment_note,
    m.payment_method::text,
    m.join_code,
    m.lineup_locked,
    m.self_report_enabled,
    m.status,
    m.score_a,
    m.score_b,
    case
      when m.group_id is not null and public.can_view_group(m.group_id, auth.uid()) then m.group_id
      else null::uuid
    end as group_id,
    case
      when m.series_id is not null then (
        select case
          when public.can_view_group(gws.group_id, auth.uid()) then m.series_id
          else null::uuid
        end
        from public.group_weekly_series gws
        where gws.id = m.series_id
      )
      else null::uuid
    end as series_id,
    case
      when m.spawned_from_match_id is not null
        and public.can_view_match(m.spawned_from_match_id, auth.uid())
      then m.spawned_from_match_id
      else null::uuid
    end as spawned_from_match_id,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'match_id', a.match_id,
          'player_id', a.player_id,
          'status', a.status,
          'paid', a.paid
        )
      )
      from att a
    ), '[]'::jsonb) as attendees,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'match_id', t.match_id,
          'player_id', t.player_id,
          'team', t.team
        )
      )
      from mtp t
    ), '[]'::jsonb) as team_players,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'match_id', s.match_id,
          'player_id', s.player_id,
          'kind', s.kind,
          'count', s.count
        )
      )
      from msl s
    ), '[]'::jsonb) as stat_lines,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', sr.id,
          'match_id', sr.match_id,
          'player_id', sr.player_id,
          'type', sr.type,
          'status', sr.status
        )
      )
      from srr sr
    ), '[]'::jsonb) as self_reports,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'display_name', p.display_name,
          'photo_uri', p.photo_uri,
          'position', p.position,
          'preferred_foot', p.preferred_foot,
          'updated_at', p.updated_at
        )
      )
      from public.profiles_public p
      inner join profile_ids pid on pid.player_id = p.id
    ), '[]'::jsonb) as profiles
  from m;
$$;

revoke execute on function public.match_graph_row_body(uuid) from public;
revoke execute on function public.match_graph_row_body(uuid) from anon;

-- Recreate match_graph_row_summary_body function with updated_at in profiles
create or replace function public.match_graph_row_summary_body(p_match_id uuid)
returns table (
  id uuid,
  starts_at timestamptz,
  venue text,
  organizer_id uuid,
  max_players int,
  price_per_person numeric,
  iban text,
  iban_account_name text,
  payment_note text,
  payment_method text,
  join_code text,
  lineup_locked boolean,
  self_report_enabled boolean,
  status public.match_status,
  score_a int,
  score_b int,
  group_id uuid,
  series_id uuid,
  spawned_from_match_id uuid,
  attendees jsonb,
  team_players jsonb,
  stat_lines jsonb,
  self_reports jsonb,
  profiles jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with m as (
    select
      mt.id,
      mt.starts_at,
      mt.venue,
      mt.organizer_id,
      mt.max_players,
      mt.price_per_person,
      mt.iban,
      mt.join_code,
      mt.lineup_locked,
      mt.self_report_enabled,
      mt.status,
      mt.score_a,
      mt.score_b,
      mt.group_id,
      mt.series_id,
      mt.spawned_from_match_id,
      mt.payment_method::text,
      mt.iban_account_name,
      mt.payment_note
    from public.matches mt
    where mt.id = p_match_id
  ),
  att as (
    select
      a.match_id,
      a.player_id,
      a.status,
      a.paid
    from public.match_attendees a
    inner join m on m.id = a.match_id
  ),
  mtp as (
    select
      t.match_id,
      t.player_id,
      t.team
    from public.match_team_players t
    inner join m on m.id = t.match_id
  ),
  profile_ids as (
    select m.organizer_id as player_id
    from m
    union
    select att.player_id
    from att
    union
    select mtp.player_id
    from mtp
  )
  select
    m.id,
    m.starts_at,
    m.venue,
    m.organizer_id,
    m.max_players,
    m.price_per_person,
    m.iban,
    m.iban_account_name,
    m.payment_note,
    m.payment_method::text,
    m.join_code,
    m.lineup_locked,
    m.self_report_enabled,
    m.status,
    m.score_a,
    m.score_b,
    case
      when m.group_id is not null and public.can_view_group(m.group_id, auth.uid()) then m.group_id
      else null::uuid
    end as group_id,
    case
      when m.series_id is not null then (
        select case
          when public.can_view_group(gws.group_id, auth.uid()) then m.series_id
          else null::uuid
        end
        from public.group_weekly_series gws
        where gws.id = m.series_id
      )
      else null::uuid
    end as series_id,
    case
      when m.spawned_from_match_id is not null
        and public.can_view_match(m.spawned_from_match_id, auth.uid())
      then m.spawned_from_match_id
      else null::uuid
    end as spawned_from_match_id,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'match_id', a.match_id,
          'player_id', a.player_id,
          'status', a.status,
          'paid', a.paid
        )
      )
      from att a
    ), '[]'::jsonb) as attendees,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'match_id', t.match_id,
          'player_id', t.player_id,
          'team', t.team
        )
      )
      from mtp t
    ), '[]'::jsonb) as team_players,
    '[]'::jsonb as stat_lines,
    '[]'::jsonb as self_reports,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'display_name', p.display_name,
          'photo_uri', p.photo_uri,
          'position', p.position,
          'preferred_foot', p.preferred_foot,
          'updated_at', p.updated_at
        )
      )
      from public.profiles_public p
      inner join profile_ids pid on pid.player_id = p.id
    ), '[]'::jsonb) as profiles
  from m;
$$;

revoke execute on function public.match_graph_row_summary_body(uuid) from public;
revoke execute on function public.match_graph_row_summary_body(uuid) from anon;
