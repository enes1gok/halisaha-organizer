-- Regression guard: rating_window_ends_at must be returned by all match-graph RPCs.
--
-- Bug history: migration 20260709120000_lineup_slot_index_and_formation.sql
-- recreated the match-graph functions to add lineup_formation_id/slot_index but
-- accidentally dropped rating_window_ends_at from every RETURNS TABLE clause.
-- After submit_match_result set rating_window_ends_at = now()+2h on the DB row,
-- the graph RPCs returned the row without that column → client saw
-- ratingWindowEndsAt = undefined → useRatingWindow treated it as isClosed = true
-- → UI showed "süre doldu" immediately after the match ended.
--
-- Fixed by: 20260710120000_fix_rating_window_in_match_graph.sql
-- This test ensures the column is present in all four public match-graph RPCs
-- both before score submission (null) and after (not null, in the future).

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

-- 3. submit_match_result succeeds (also sets rating_window_ends_at = now()+2h)
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

-- 4. get_match_graph_for_user: column not null after submit
select ok(
  (
    select rating_window_ends_at is not null
    from public.get_match_graph_for_user('f0000000-0000-4000-8000-000000000080'::uuid)
  ),
  'after submit: get_match_graph_for_user returns non-null rating_window_ends_at'
);

-- 5. rating_window_ends_at is in the future — window is open
select ok(
  (
    select rating_window_ends_at > now()
    from public.get_match_graph_for_user('f0000000-0000-4000-8000-000000000080'::uuid)
  ),
  'after submit: rating_window_ends_at is in the future (window open)'
);

-- 6. list_visible_match_graphs_for_user: column not null after submit
select ok(
  (
    select rating_window_ends_at is not null
    from public.list_visible_match_graphs_for_user(null)
    where id = 'f0000000-0000-4000-8000-000000000080'::uuid
  ),
  'after submit: list_visible_match_graphs_for_user returns non-null rating_window_ends_at'
);

-- 7. list_visible_match_summaries_for_user: column not null after submit
select ok(
  (
    select rating_window_ends_at is not null
    from public.list_visible_match_summaries_for_user(null)
    where id = 'f0000000-0000-4000-8000-000000000080'::uuid
  ),
  'after submit: list_visible_match_summaries_for_user returns non-null rating_window_ends_at'
);

-- 8. list_match_graphs_for_match_ids: column not null after submit
select ok(
  (
    select rating_window_ends_at is not null
    from public.list_match_graphs_for_match_ids(
      array['f0000000-0000-4000-8000-000000000080'::uuid]
    )
  ),
  'after submit: list_match_graphs_for_match_ids returns non-null rating_window_ends_at'
);

select * from finish();

rollback;
