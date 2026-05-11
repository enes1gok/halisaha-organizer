---
name: evolve-postgres-function
description: Supabase migration'da Postgres fonksiyon/RPC imzasını, dönüş tipini veya grant'ları güvenli şekilde değiştirir. CREATE OR REPLACE FUNCTION'ın SQLSTATE 42P13 "cannot change return type of existing function" hatası verdiğinde, RETURNS TABLE kolonları eklenip/silindiğinde/yeniden sıralandığında, parametre adları/varsayılanları değiştiğinde veya DROP sonrası REVOKE/GRANT yeniden yayınlanması gerektiğinde kullan.
---

# Evolve Postgres function (signature-safe migration)

Use when a migration must change a function/RPC's **return type**, **parameter list**,
**parameter names**, **defaults**, or **OUT direction**. `CREATE OR REPLACE FUNCTION`
cannot apply those changes to an existing function; Postgres raises **`42P13`** with
message **`cannot change return type of existing function`** (including `RETURNS TABLE`
column changes). A fresh `supabase db reset` can hide this; CI or applying migrations
onto an already-migrated DB surfaces it.

## 1. Classify the change

| Change | `CREATE OR REPLACE` OK? | Action |
|--------|-------------------------|--------|
| Body / SQL only (same signature + return type) | Yes | `create or replace function` |
| Add/remove/rename/reorder `RETURNS TABLE (...)` columns | No | `DROP FUNCTION` + recreate |
| Add/remove/rename IN parameters; change defaults | No | `DROP FUNCTION` + recreate |
| Change `SECURITY DEFINER` ↔ `INVOKER` | Yes (often) | Prefer `ALTER FUNCTION ... SECURITY` |

## 2. DROP with the full old signature

Postgres resolves overloads by **argument types only**. Use the exact shipped signature:

```sql
drop function if exists public.my_fn(timestamptz, text, uuid);
```

- Do **not** use `drop function if exists public.my_fn(...)` — `(...)` is not a wildcard; it is invalid for this purpose.
- Find the latest prior definition: search `supabase/migrations` for `create or replace function public.my_fn` and copy the argument type list from the **most recent** migration before yours.

## 3. Recreate + re-apply metadata

After `DROP`, privileges and comments attached to the old OID are gone. Re-emit against the **new** signature:

- `comment on function public.my_fn(<new arg types>) is '...';`
- `revoke execute on function public.my_fn(<new arg types>) from public;`
- `revoke execute on function public.my_fn(<new arg types>) from anon;` (when narrowing anon per [security_linter_hardening](../../supabase/migrations/20260514120000_security_linter_hardening.sql))
- `grant execute on function public.my_fn(<new arg types>) to authenticated;` (or `service_role` for jobs — match prior migrations)

Internal helpers intentionally **without** `grant ... to authenticated` must still get `revoke ... from public` and `revoke ... from anon` if they were `security definer` and previously hardened.

## 4. Dependent functions and views

If `f()` calls `g()` or a view selects from `g()`, you cannot `DROP g` while dependents exist.

- Drop **dependents first** (reverse dependency order), then `g`, then recreate `g`, then dependents.
- Example: `get_match_graph_for_user` selects from `match_graph_row` → drop `get_match_graph_for_user` and `list_visible_match_graphs_for_user` before dropping `match_graph_row`, then recreate `match_graph_row`, then wrappers.

## 5. Client / TypeScript sync

- Update `src/services/supabase` RPC callers if parameter names, order, or presence changed (named `supabase.rpc` args).
- PostgREST **`PGRST202`** if the client calls a signature not deployed yet — see [.claude/rules/supabase-governance.md](.claude/rules/supabase-governance.md) (Client/RPC sync gate).

## 6. Verification

- `npm run test:rls:sql` after `supabase db reset` (full chain).
- **Non-empty schema:** a clean reset re-runs all migrations from scratch and can mask `42P13`; also verify applying your migration onto a DB that already had prior migrations (or use `FORCE_DB_RESET=1` / incremental apply per team playbook).
- pgTAP: assert new `RETURNS TABLE` columns or RPC behavior where relevant.

## Anti-patterns

- `drop function ... (...)` literal instead of real types.
- `DROP` without re-emitting `REVOKE`/`GRANT` → regressions vs [security_linter_hardening](../../supabase/migrations/20260514120000_security_linter_hardening.sql).
- Updating one overload of a polymorphic name and leaving another stale.

## Related

- Rule: [.claude/rules/supabase-schema-evolution.md](.claude/rules/supabase-schema-evolution.md) — **Function evolution** section.
- [.claude/skills/add-atomic-rpc.md](.claude/skills/add-atomic-rpc.md) — new RPC design + pgTAP.
- [.claude/skills/supabase-governance.md](.claude/skills/supabase-governance.md) — RLS test commands, operational playbook.
- [.claude/skills/debug-supabase-error.md](.claude/skills/debug-supabase-error.md) — runtime `ERR_*`, RLS (`42501`); different layer than migration-time `42P13`.
