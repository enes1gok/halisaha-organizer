-- Partitioning / capacity baseline — run in Supabase SQL Editor or psql against staging/prod.
-- Purpose: decide whether native declarative partitioning is justified (see docs/architecture/database-partition-feasibility.md).
-- Replace placeholders before EXPLAIN sections.

-- ---------------------------------------------------------------------------
-- 1) Table health (row counts, sequential scans, dead rows)
-- ---------------------------------------------------------------------------
select
  relname,
  n_live_tup as est_live_rows,
  n_dead_tup as est_dead_rows,
  seq_scan,
  idx_scan,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
from pg_stat_user_tables
where schemaname = 'public'
  and relname in ('matches', 'notification_deliveries')
order by relname;

-- Approximate disk footprint (toast included).
select
  tablename,
  pg_size_pretty(pg_total_relation_size(format('%I.%I', schemaname, tablename)::regclass)) as total_size
from pg_tables
where schemaname = 'public'
  and tablename in ('matches', 'notification_deliveries');

-- ---------------------------------------------------------------------------
-- 2) notification_deliveries shape (how much is terminal history vs active queue)
-- ---------------------------------------------------------------------------
select status, count(*) as rows
from public.notification_deliveries
group by status
order by rows desc;

select
  date_trunc('month', created_at at time zone 'UTC') as month_utc,
  count(*) as rows
from public.notification_deliveries
group by 1
order by 1 desc
limit 24;

-- ---------------------------------------------------------------------------
-- 3) Hot-path templates — paste real predicates after baseline row counts exist.
--    Use EXPLAIN (ANALYZE, BUFFERS) only on non-production or during a maintenance window.
-- ---------------------------------------------------------------------------

-- Claim worker shape (pending ordered by schedule / created_at).
-- explain (analyze, buffers)
-- select inner_nd.id
-- from public.notification_deliveries inner_nd
-- where inner_nd.status = 'pending'
--   and (inner_nd.scheduled_for is null or inner_nd.scheduled_for <= now())
-- order by coalesce(inner_nd.scheduled_for, inner_nd.created_at), inner_nd.created_at
-- limit 50;

-- Typical group match listing by time (matches + group_id).
-- explain (analyze, buffers)
-- select id, starts_at, status
-- from public.matches
-- where group_id = '<uuid>'::uuid
--   and starts_at >= now()
-- order by starts_at
-- limit 50;

-- ---------------------------------------------------------------------------
-- 4) Suggested decision thresholds (guidance only — product/ops signs off)
-- ---------------------------------------------------------------------------
-- Consider retention + indexing first when:
--   * notification_deliveries.idx_scan / (seq_scan + idx_scan) is healthy on claim path,
--     but n_live_tup > tens of millions OR dead tuple ratio drives bloat.
--   * matches list queries stay index-backed but table exceeds comfortable vacuum windows.
-- Native RANGE partitioning needs schema redesign when:
--   * notification_deliveries: partial UNIQUE + ON CONFLICT must align with partition key.
--   * matches: composite PK (id, starts_at) + child FK columns — wide migration.
