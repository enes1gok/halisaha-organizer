# Supabase schema evolution

Apply when authoring migrations or SQL under `supabase/` (alongside [supabase-governance.md](supabase-governance.md) for migration-first and security).

## New tables

- Include `updated_at timestamptz not null default now()` unless the table is strictly append-only with no row updates; if omitting, add a one-line rationale in the migration/PR.
- Attach `BEFORE UPDATE` trigger using existing [`public.set_updated_at()`](../../supabase/migrations/20260507120000_initial_schema.sql): naming pattern `{table}_set_updated_at`.

```sql
-- Example pattern (names vary per migration)
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();
```

## Enum changes

- Adding new enum values is usually backward compatible for readers; removing, renaming, or renumbering requires a multi-step migration and/or compatibility layer so older clients still see meaningful values.
- Risky changes: plan data backfill and rollout order; document in the migration or PR checklist.

## Foreign keys

- Every `REFERENCES` clause must specify **both** `ON DELETE` and `ON UPDATE` explicitly (`CASCADE`, `SET NULL`, `RESTRICT`, etc.). Do not rely on implicit defaults.

## Function evolution

`CREATE OR REPLACE FUNCTION` cannot change:

- the return type — including any change to `RETURNS TABLE (...)` columns (add/remove/rename/reorder)
- parameter names, defaults, or `IN`/`OUT` direction

When any of these change, the migration must:

1. `DROP FUNCTION IF EXISTS public.fn(<exact_old_signature>);` — full argument **type** list only, not `(...)` as a wildcard.
2. Recreate the function with the new signature.
3. Re-apply matching `COMMENT ON FUNCTION`, `REVOKE`, and `GRANT EXECUTE` using the **new** signature (a `DROP` removes prior grants on that OID).
4. If the function is referenced by other functions or views, update or drop/recreate those in **dependency order** in the same migration (dependents dropped before the callee).

See skill [.claude/skills/evolve-postgres-function.md](../skills/evolve-postgres-function.md) (SQLSTATE **`42P13`**, *cannot change return type of existing function*).

## Related

- Migration workflow and RLS: [supabase-governance.md](supabase-governance.md).
