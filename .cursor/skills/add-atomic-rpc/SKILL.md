---
name: add-atomic-rpc
description: >-
  Designs and ships Postgres RPCs for atomic multi-table business logic: requirements,
  SQL function draft, RLS/grants, pgTAP tests. Use when adding or changing Supabase RPCs,
  atomic transactions, or implementing rules covered by atomic-mutation-policy.
---

# Add atomic RPC (Postgres)

Use this skill when new business logic must be **correct under concurrency** and **not** implemented as chained client writes. This repo’s policy is in [`atomic-mutation-policy.mdc`](../../rules/atomic-mutation-policy.mdc).

## Trigger conditions

- New or updated **Postgres function** exposed as Supabase RPC.
- Writes that touch **multiple tables** and must commit or roll back **together**.
- Refactoring legacy multi-step client writes into a **single transaction**.

## Preconditions (RPC or not)

- If the change is **one table, one row**, a single `insert`/`update`/`delete` may suffice — still validate RLS per [`supabase-governance`](../supabase-governance/SKILL.md).
- If multiple tables or invariant spans several statements → **one RPC** inside one transaction; do not chain independent calls from the client for that flow.

## Workflow

### 1. Gereksinim analizi

- List **invariants** (what must always be true after success).
- List **tables/views** touched and **order of effects** inside the function.
- Define **failure behavior** (raise vs. no-op) and whether the operation must be **retry-safe**; if yes, apply [`refactor-to-idempotent-logic`](../refactor-to-idempotent-logic/SKILL.md).

### 2. SQL fonksiyonu taslağı

- Keep **all mutating steps** in **one** function body so Postgres runs them as **one transaction** (implicit until commit).
- Choose **`SECURITY INVOKER`** vs **`SECURITY DEFINER`** and document why; follow detailed guidance in [`supabase-governance`](../supabase-governance/SKILL.md) and [`supabase-governance.mdc`](../../rules/supabase-governance.mdc).
- Put schema changes in migrations per [`supabase-schema-evolution.mdc`](../../rules/supabase-schema-evolution.mdc); keep the function definition aligned with migrated tables and FK behavior.

### 3. RLS ve grant tanımları

- Ensure policies allow the **intended role path** for every statement the RPC executes (`SELECT`/`INSERT`/… as needed).
- Grant **`EXECUTE`** on the function to the correct roles; avoid widening table access beyond what policies require.
- Do **not** duplicate the full RLS playbook here — use [`supabase-governance`](../supabase-governance/SKILL.md) for policy matrices and risk checks.

### 4. pgTAP test senaryosu

- Add or extend tests under [`supabase/tests/`](../../../supabase/tests/) (helpers: `000_helpers.sql`).
- Cover **success** and **deny** paths for the roles that call the RPC.
- Run **`npm run test:rls:sql`** (uses `supabase test db` after `supabase start` + `supabase db reset`). Full matrix: [`supabase-governance`](../supabase-governance/SKILL.md) (“RLS / policy regression tests”).
- If the RPC must be idempotent, add a **double-invoke** assertion (second call does not duplicate side effects) per [`refactor-to-idempotent-logic`](../refactor-to-idempotent-logic/SKILL.md).

## Related

- [`atomic-mutation-policy.mdc`](../../rules/atomic-mutation-policy.mdc) — when RPC is mandatory; optimistic UI ordering.
- [`supabase-governance`](../supabase-governance/SKILL.md) — RLS, migrations, test commands, CI.
- [`supabase-schema-evolution.mdc`](../../rules/supabase-schema-evolution.mdc) — migrations and schema changes.
