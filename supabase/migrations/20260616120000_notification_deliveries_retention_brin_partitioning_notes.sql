-- Terminal-row retention for notification_deliveries (reduces bloat / sequential scans on history).
-- Optional BRIN on created_at for large time-range reporting-style scans.
-- Table COMMENTs record partitioning deferral — see docs/architecture/database-partition-feasibility.md

-- ---------------------------------------------------------------------------
-- 1) Batch purge (terminal statuses only; never pending/sending)
-- ---------------------------------------------------------------------------

create or replace function public.purge_old_notification_deliveries(
  p_retention_days integer default 90,
  p_batch_limit integer default 10000
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total bigint := 0;
  v_batch int := 0;
  v_days int := greatest(coalesce(p_retention_days, 90), 30);
  v_lim int := greatest(1, least(coalesce(p_batch_limit, 10000), 50000));
  v_cutoff timestamptz := now() - make_interval(days => v_days);
begin
  loop
    delete from public.notification_deliveries
    where ctid in (
      select ctid
      from public.notification_deliveries
      where status in ('sent', 'failed', 'in_app')
        and created_at < v_cutoff
      limit v_lim
    );

    get diagnostics v_batch = row_count;
    v_total := v_total + v_batch;
    exit when v_batch = 0;
  end loop;

  return v_total;
end;
$$;

comment on function public.purge_old_notification_deliveries(integer, integer) is
  'Deletes terminal notification_deliveries rows older than retention_days (minimum 30). Batched for safe cron execution; returns rows deleted.';

revoke all on function public.purge_old_notification_deliveries(integer, integer) from public;
revoke all on function public.purge_old_notification_deliveries(integer, integer) from anon;

grant execute on function public.purge_old_notification_deliveries(integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 2) pg_cron: daily purge (03:30 UTC); idempotent schedule
-- ---------------------------------------------------------------------------

do $$
declare
  v_job record;
begin
  for v_job in
    select jobid
    from cron.job
    where jobname = 'notification-deliveries-retention-purge'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
exception
  when undefined_table then
    null;
end $$;

select cron.schedule(
  'notification-deliveries-retention-purge',
  '30 3 * * *',
  $$ select public.purge_old_notification_deliveries(); $$
);

-- ---------------------------------------------------------------------------
-- 3) BRIN — cheap correlation with created_at on large append-heavy tables
-- ---------------------------------------------------------------------------

create index if not exists notification_deliveries_created_at_brin_idx
  on public.notification_deliveries
  using brin (created_at)
  with (pages_per_range = 128);

comment on index public.notification_deliveries_created_at_brin_idx is
  'Optional support for coarse time-range scans; complements partial btree indexes on hot paths.';

-- ---------------------------------------------------------------------------
-- 4) Operator-facing partitioning decision pointers
-- ---------------------------------------------------------------------------

comment on table public.matches is
  'Core match rows; referenced broadly by child tables. Declarative RANGE(time) partitioning deferred — composite PK/FK migration required; see docs/architecture/database-partition-feasibility.md';

comment on table public.notification_deliveries is
  'Push/in-app delivery queue + history. Terminal rows purged by purge_old_notification_deliveries (cron). Declarative partitioning deferred — partial UNIQUE + ON CONFLICT must be redesigned with partition key; see docs/architecture/database-partition-feasibility.md';
