---
name: refactor-to-idempotent-logic
description: >-
  Makes Postgres functions and jobs safe to retry: ON CONFLICT, EXISTS guards,
  status-based protection, unique keys. Use when refactoring cron jobs, webhooks,
  queue retries, or RPCs like recurring match spawn so failures can be re-run without duplicates.
---

# Refactor to idempotent logic

Use this skill when the same operation may run **more than once** (scheduled jobs, manual retries, timeouts, duplicate deliveries) and must not **double-insert**, **double-charge**, or leave **invalid intermediate states**.

## Trigger conditions

- Cron / Edge schedule / database job that **might overlap** or **re-run** after partial failure.
- RPCs or triggers invoked from **retrying** clients or workers.
- Refactors of functions such as recurring **spawn** flows where a second run must be a **no-op** or **harmless upsert**.

## Tasarım: “aynı iş” kimliği

Before picking SQL patterns, define what counts as **one logical operation** (e.g. “spawn week N for series S”). Encode that as:

- A **unique constraint** or **unique index** on the natural key columns, or
- An explicit **dedupe / idempotency** row or status transition only valid once.

Without this, `ON CONFLICT` and “skip if exists” guards have nothing stable to anchor to.

## Teknikler

### `ON CONFLICT`

- **`ON CONFLICT DO NOTHING`** when duplicate inserts are acceptable and later reads should see one row.
- **`ON CONFLICT DO UPDATE`** when the logical operation should **merge** or **refresh** fields on retry.

Ensure conflict targets match your **unique** constraint definition.

### `EXISTS` kontrolleri

- Short-circuit: `IF EXISTS (SELECT 1 FROM ... WHERE ...)` then **return early** or skip work when the outcome is already satisfied.
- Prefer **indexed** predicates aligned with list/filter patterns.

### Durum (status) bazlı korumalar

- Use a **state machine**: only transition from allowed states (e.g. `pending` → `completed`), and reject or no-op when already `completed` / `cancelled`.
- Combine with row-level **locking** only when two writers could race on the same aggregate (document when `SELECT … FOR UPDATE` is justified).

## Doğrulama

- **pgTAP / SQL tests:** invoke the function **twice** with the same inputs; assert row counts and critical columns unchanged on the second call (see [`add-atomic-rpc`](../add-atomic-rpc/SKILL.md) step 4).
- Negative cases: partial inputs should not leave orphan rows if the function raises.

## Related

- [`add-atomic-rpc`](../add-atomic-rpc/SKILL.md) — atomic boundaries and pgTAP placement under `supabase/tests/`.
- [`supabase-governance`](../supabase-governance/SKILL.md) — RLS and regression test commands.
