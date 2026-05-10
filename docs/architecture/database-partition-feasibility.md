# Database partitioning feasibility (matches, notification_deliveries)

This document records the engineering assessment for **declarative table partitioning** on `public.matches` and `public.notification_deliveries`, aligned with the capacity baseline script at [`supabase/scripts/partitioning_capacity_baseline.sql`](../../supabase/scripts/partitioning_capacity_baseline.sql).

## 1. `public.matches`

### RANGE(`starts_at`) or RANGE(`created_at`)

PostgreSQL requires every **PRIMARY KEY** and **UNIQUE** constraint on a partitioned table to include **all** partition key columns.

Today:

- Primary key is `(id)`.
- Many dependent tables reference only `match_id` → `matches(id)` (attendees, lineup, stats, notifications, ratings, weekly series self-FK, …).

A RANGE partition on time implies:

- Either `(id, starts_at)` as the match primary key and propagating `starts_at` (or equivalent) into **every** child table with composite foreign keys, **or**
- Accepting that incremental “ALTER TABLE … PARTITION BY” is not a small DDL change — it is a **cross-cutting domain migration** (SQL migrations, RPCs, triggers, client types).

**Verdict:** RANGE partitioning is **feasible only as a deliberate major release**, after cost/benefit vs archiving and index tuning. Time-based **partition pruning** does not help the dominant access pattern **`by id`** unless queries are rewritten to include partition key predicates everywhere.

### HASH(`id`)

- Keeps a single-column PK and existing foreign keys.
- Spreads heap storage across partitions but **does not** prune by `starts_at` for list/range queries.

**Verdict:** Useful mainly at very large table sizes for I/O spread; measure before investing.

## 2. `public.notification_deliveries`

### RANGE(`created_at`)

Append-heavy queue + history. Claim path orders by `scheduled_for` / `created_at` (see `claim_pending_deliveries`).

Blockers for naive RANGE partitioning:

1. **Unique constraints** must include the partition key. The pipeline relies on **partial UNIQUE indexes** and `ON CONFLICT` for deduplication per `type` (initial, reminder, cancellation, …). Rebuilding those constraints without widening uniqueness incorrectly risks duplicate logical deliveries or requires **application-level** dedup (e.g. `SELECT … FOR UPDATE` in security definer RPCs only).

2. **Nullable `match_id` / `group_id`** (`streak_at_risk`) increases edge cases for integrity and indexing.

**Verdict:** Prefer **retention** of terminal rows (`sent`, `failed`, `in_app`) plus targeted indexes (including optional BRIN on `created_at` for large scans) before attempting declarative partitioning.

### UNIQUE + `ON CONFLICT` redesign (sketch)

If partitioning becomes mandatory:

- Option A: Add a **bucket** column (e.g. `date_trunc('month', created_at)`) to every partial unique definition so uniqueness is “per month” — only safe if business rules guarantee no duplicate logical keys across months (usually true for one-off deliveries; **must** be validated per `type`).
- Option B: Drop global partial uniques for hot types and enforce dedup **only** inside `SECURITY DEFINER` enqueue functions with explicit locking or advisory locks — higher concurrency risk, fewer DB guarantees.

Each option requires full **pgTAP** regression across `supabase/tests/notification_*.test.sql` and Edge writers.

## 3. Native declarative partitioning — deployment status

**Not deployed** in the migration set that introduced retention + BRIN + these notes. Re-evaluate after:

1. Running [`supabase/scripts/partitioning_capacity_baseline.sql`](../../supabase/scripts/partitioning_capacity_baseline.sql) on staging/production-scale data.
2. Confirming retention and vacuum health improvements are insufficient.

Table comments on `matches` and `notification_deliveries` point here for future operators.
