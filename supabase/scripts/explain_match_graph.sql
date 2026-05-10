-- Baseline / regression checks for match-graph RPCs (run in SQL editor or psql against staging).
-- Replace :match_id with a real uuid the current role can view.
-- Payload size: compare total result row byte length (pg_column_size) before/after optimizations.

-- Single-match path (visibility enforced inside get_match_graph_for_user → match_graph_row).
explain (analyze, buffers, verbose)
select *
from public.get_match_graph_for_user('00000000-0000-0000-0000-000000000001'::uuid);

-- List path — full graph (visibility filter + lateral body; optional limit).
explain (analyze, buffers, verbose)
select *
from public.list_visible_match_graphs_for_user(null);

explain (analyze, buffers, verbose)
select *
from public.list_visible_match_graphs_for_user(50);

-- List hydrate fast path — attendees + teams + profiles only (empty stat_lines / self_reports JSON).
explain (analyze, buffers, verbose)
select *
from public.list_visible_match_summaries_for_user(null);

-- Batch path (per-id visibility via match_graph_row wrapper).
explain (analyze, buffers, verbose)
select *
from public.list_match_graphs_for_match_ids(
  array['00000000-0000-0000-0000-000000000001'::uuid]
);
