-- Regression guard: rating_window_ends_at and rating_closed_at must be returned
-- by all match-graph RPCs.
--
-- Bug history (20260709): lineup_slot_index_and_formation.sql recreated match-graph
-- functions but accidentally dropped rating_window_ends_at from RETURNS TABLE.
-- Fixed by 20260710120000_fix_rating_window_in_match_graph.sql.
--
-- Semantic update (20260712): rating_manual_close.sql changed submit_match_result
-- so it NO LONGER sets rating_window_ends_at. Rating window is now open by default
-- from starts_at and closed manually via close_match_rating() (sets rating_closed_at).
-- rating_closed_at was also added to all match-graph RETURNS TABLE in that migration.
--
-- This test guards that BOTH columns (rating_window_ends_at, rating_closed_at) exist
-- in all four public match-graph RPCs and carry the correct null/non-null values.

begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select tests.reset_session();
select tests.create_user(tests.uuid_organizer());
select tests.create_user(tests.uuid_participant());

-- Match that started 90 minutes ago so submit_match_result's 60-minute guard passes
insert into public.matches (id, starts_at, venue, organizer_id, join_code, max_players)
values (
  'f0000000-0000-4000-8000-000000000080'::uuid,
  now() - interval '90 minutes',
  'Rating Window Test',
  tests.uuid_organizer(),
  'RATEWIN080',
  14
);

insert into public.match_attendees (match_id, player_id, status, paid)
values
  ('f0000000-0000-4000-8000-000000000080'::uuid, tests.uuid_organizer(),   'going', false),
  ('f0000000-0000-4000-8000-000000000080'::uuid, tests.uuid_participant(), 'going', false);

select tests.authenticate_as(tests.uuid_organizer());

-- ── Before score submission ──────────────────────────────────────────────────

-- 1. get_match_graph_for_user: column present but null before submit
select is(
  (
    select rating_window_ends_at
    from public.get_match_graph_for_user('f0000000-0000-4000-8000-000000000080'::uuid)
  ),
  null::timestamptz,
  'before submit: get_match_graph_for_user.rating_window_ends_at is null'
);

-- 2. list_visible_match_summaries_for_user: column present but null before submit
select is(
  (
    select rating_window_ends_at
    from public.list_visible_match_summaries_for_user(null)
    where id = 'f0000000-0000-4000-8000-000000000080'::uuid
  ),
  null::timestamptz,
  'before submit: list_visible_match_summaries_for_user.rating_window_ends_at is null'
);

-- ── Score submission ─────────────────────────────────────────────────────────

-- 3. submit_match_result succeeds
select lives_ok(
  $$
    select public.submit_match_result(
      'f0000000-0000-4000-8000-000000000080'::uuid,
      2, 1,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb
    )
  $$,
  'submit_match_result runs without error'
);

-- ── After score submission ───────────────────────────────────────────────────
-- Since 20260712: submit_match_result no longer sets rating_window_ends_at.
-- Window opens at starts_at and closes when organizer calls close_match_rating().
-- Both columns must exist in RPC output; rating_closed_at IS NULL = window open.

-- 4. get_match_graph_for_user: rating_window_ends_at still null after submit (no longer set)
select is(
  (
    select rating_window_ends_at
    from public.get_match_graph_for_user('f0000000-0000-4000-8000-000000000080'::uuid)
  ),
  null::timestamptz,
  'after submit: rating_window_ends_at is null (submit no longer sets it)'
);

-- 5. get_match_graph_for_user: rating_closed_at is null = window open (column exists)
select is(
  (
    select rating_closed_at
    from public.get_match_graph_for_user('f0000000-0000-4000-8000-000000000080'::uuid)
  ),
  null::timestamptz,
  'after submit: rating_closed_at is null (window open by default)'
);

-- 6. list_visible_match_graphs_for_user: rating_closed_at column present and null
select is(
  (
    select rating_closed_at
    from public.list_visible_match_graphs_for_user(null)
    where id = 'f0000000-0000-4000-8000-000000000080'::uuid
  ),
  null::timestamptz,
  'after submit: list_visible_match_graphs_for_user.rating_closed_at is null'
);

-- 7. list_visible_match_summaries_for_user: rating_closed_at column present and null
select is(
  (
    select rating_closed_at
    from public.list_visible_match_summaries_for_user(null)
    where id = 'f0000000-0000-4000-8000-000000000080'::uuid
  ),
  null::timestamptz,
  'after submit: list_visible_match_summaries_for_user.rating_closed_at is null'
);

-- 8. list_match_graphs_for_match_ids: rating_closed_at column present and null
select is(
  (
    select rating_closed_at
    from public.list_match_graphs_for_match_ids(
      array['f0000000-0000-4000-8000-000000000080'::uuid]
    )
  ),
  null::timestamptz,
  'after submit: list_match_graphs_for_match_ids.rating_closed_at is null'
);

select * from finish();

rollback;
