-- Emergency idempotent fix: constraint mismatch from migrations recorded-but-not-executed.
--
-- Problem: 20260624120000_roster_full_organizer added new types to
-- notification_deliveries_type_check (streak_at_risk, payment_morning_reminder,
-- payment_unpaid_summary_organizer, roster_full_organizer) WITHOUT updating
-- notification_deliveries_reminder_date_chk — causing pgCode 23514 (CHECK violation)
-- whenever a trigger inserts one of these types.
-- 20260626000000_fix_test_failures was the intended fix but may not have executed.
--
-- Also fixes: any matches/group_weekly_series rows with odd max_players that
-- survived prior backfills (same idempotent rounding as 20260620120000).

-- ── 1. notification_deliveries_reminder_date_chk ─────────────────────────────

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_reminder_date_chk;

alter table public.notification_deliveries
  add constraint notification_deliveries_reminder_date_chk check (
    (
      type in (
        'initial', 'match_cancelled', 'venue_change', 'lineup_published',
        'match_result', 'roster_full_organizer'
      )
      and reminder_date is null
    )
    or (
      type in (
        'reminder', 'payment_reminder', 'post_match_rating_reminder',
        'streak_at_risk', 'payment_morning_reminder',
        'payment_unpaid_summary_organizer'
      )
      and reminder_date is not null
    )
  );

-- ── 2. notification_deliveries_match_group_ctx_chk ───────────────────────────

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_match_group_ctx_chk;

alter table public.notification_deliveries
  add constraint notification_deliveries_match_group_ctx_chk check (
    (
      type = 'streak_at_risk'
      and match_id is null
      and group_id is null
    )
    or (
      type <> 'streak_at_risk'
      and match_id is not null
      and group_id is not null
    )
  );

-- ── 3. matches + group_weekly_series: odd max_players backfill ────────────────

update public.matches
set max_players = (
  round(least(22, greatest(4, max_players))::numeric / 2) * 2
)::int
where max_players % 2 != 0;

update public.group_weekly_series
set max_players = (
  round(least(22, greatest(4, max_players))::numeric / 2) * 2
)::int
where max_players % 2 != 0;
