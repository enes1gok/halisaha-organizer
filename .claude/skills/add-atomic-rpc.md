---
name: add-atomic-rpc
description: Atomik çok-tablo iş mantığı için Postgres RPC tasarlar ve yayınlar — gereksinimler, SQL fonksiyon taslağı, RLS/grants, pgTAP testleri. Yeni veya değişen Supabase RPC, atomik transaction veya atomic-mutation-policy kapsamındaki kurallar için kullan.
---

# Add atomic RPC (Postgres)

Use this skill when new business logic must be **correct under concurrency** and **not** implemented as chained client writes. This repo's policy is in [.claude/rules/atomic-mutation-policy.md](.claude/rules/atomic-mutation-policy.md).

## Trigger conditions

- New or updated **Postgres function** exposed as Supabase RPC.
- Writes that touch **multiple tables** and must commit or roll back **together**.
- Refactoring legacy multi-step client writes into a **single transaction**.

## Preconditions (RPC or not)

- If the change is **one table, one row**, a single `insert`/`update`/`delete` may suffice — still validate RLS per [.claude/skills/supabase-governance.md](.claude/skills/supabase-governance.md).
- If multiple tables or invariant spans several statements → **one RPC** inside one transaction; do not chain independent calls from the client for that flow.

## Workflow

### 1. Gereksinim analizi

- List **invariants** (what must always be true after success).
- List **tables/views** touched and **order of effects** inside the function.
- Define **failure behavior** (raise vs. no-op) and whether the operation must be **retry-safe**; if yes, apply [.claude/skills/refactor-to-idempotent-logic.md](.claude/skills/refactor-to-idempotent-logic.md).

### 2. SQL fonksiyonu taslağı

- Keep **all mutating steps** in **one** function body so Postgres runs them as **one transaction** (implicit until commit).
- Choose **`SECURITY INVOKER`** vs **`SECURITY DEFINER`** and document why; follow detailed guidance in [.claude/skills/supabase-governance.md](.claude/skills/supabase-governance.md) and [.claude/rules/supabase-governance.md](.claude/rules/supabase-governance.md).
- Put schema changes in migrations per [.claude/rules/supabase-schema-evolution.md](.claude/rules/supabase-schema-evolution.md); keep the function definition aligned with migrated tables and FK behavior.

### 3. RLS ve grant tanımları

- Ensure policies allow the **intended role path** for every statement the RPC executes (`SELECT`/`INSERT`/… as needed).
- Grant **`EXECUTE`** on the function to the correct roles; avoid widening table access beyond what policies require.
- Do **not** duplicate the full RLS playbook here — use [.claude/skills/supabase-governance.md](.claude/skills/supabase-governance.md) for policy matrices and risk checks.

### 4. pgTAP test senaryosu

- Add or extend tests under [supabase/tests/](../../supabase/tests/) (helpers: `000_helpers.sql`).
- Cover **success** and **deny** paths for the roles that call the RPC.
- Run **`npm run test:rls:sql`** (uses `supabase test db` after `supabase start` + `supabase db reset`). Full matrix: [.claude/skills/supabase-governance.md](.claude/skills/supabase-governance.md) ("RLS / policy regression tests").
- If the RPC must be idempotent, add a **double-invoke** assertion (second call does not duplicate side effects) per [.claude/skills/refactor-to-idempotent-logic.md](.claude/skills/refactor-to-idempotent-logic.md).

## Related

- [.claude/rules/atomic-mutation-policy.md](.claude/rules/atomic-mutation-policy.md) — when RPC is mandatory; optimistic UI ordering.
- [.claude/skills/supabase-governance.md](.claude/skills/supabase-governance.md) — RLS, migrations, test commands, CI.
- [.claude/rules/supabase-schema-evolution.md](.claude/rules/supabase-schema-evolution.md) — migrations and schema changes.
