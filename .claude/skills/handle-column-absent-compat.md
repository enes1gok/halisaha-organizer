---
name: handle-column-absent-compat
description: Apply when a multi-query (direct table) path selects a newly-added column that may not exist on all deployed Supabase instances, causing PG error 42703 (undefined_column). Wraps the query with a retry-without-column fallback so the app degrades gracefully instead of surfacing an error to the user.
---

# Skill: Handle column-absent compatibility (PG 42703)

## When to apply

A migration added a new column to an existing table (e.g. `photo_uri` on `groups`). A client-side query path **explicitly names that column** in a `SELECT`. Users connecting to Supabase instances where the migration hasn't been applied yet get:

```
PostgrestError: column <table>.<column> does not exist  (code: "42703")
```

This typically surfaces in **multi-query fallback paths** — the RPC path usually fails first (PGRST202 or schema cache miss) and the fallback is the one hitting the raw table with an explicit column list.

## Pattern

Extract a `fetch<Entity>Resilient` helper that:
1. Tries the full SELECT including the new column
2. On `42703`, retries the SELECT without the new column and patches the result with `null`
3. Returns `{ data, error }` in the same shape so callers are unchanged

```typescript
async function fetchGroupsResilient(
  supabase: ReturnType<typeof getSupabaseClient>,
  groupIds: string[],
): Promise<{ data: GroupRow[] | null; error: unknown }> {
  const full = await supabase
    .from('groups')
    .select('id,name,owner_id,join_code,created_at,photo_uri')
    .in('id', groupIds);

  // PG 42703 = undefined_column — migration not yet applied, degrade gracefully
  if ((full.error as { code?: string } | null)?.code === '42703') {
    const slim = await supabase
      .from('groups')
      .select('id,name,owner_id,join_code,created_at')
      .in('id', groupIds);
    return {
      data: slim.data?.map((g) => ({ ...g, photo_uri: null })) ?? null,
      error: slim.error,
    };
  }

  return { data: full.data as GroupRow[] | null, error: full.error };
}
```

Then in the fallback query function, replace the inline `.select(…new_column…)` with a call to the helper.

## Prerequisites for graceful degradation

For the retry to be transparent end-to-end, three things must already be true (they usually are when columns are added incrementally):

1. **DB row type** (`src/services/supabase/types.ts`) — new field typed as `T | null`
2. **Mapper** (`src/services/supabase/mappers.ts`) — new field uses `?? undefined` or similar null-safe coercion
3. **Domain type** (`src/types/domain.ts`) — new field is optional (`field?: T`)

If any of these are missing, add them first.

## What NOT to do

- Do not swallow the error silently without the retry; the retry ensures data integrity for migrated instances.
- Do not apply this pattern to RPC calls — they already fail at the PGRST level and have their own fallback. This pattern is for direct `.from(table).select(columns)` queries only.
- Do not hard-code `null` as the permanent value; the retry uses `null` only as a migration-gap fill. Once the migration is universally applied, the helper still works correctly by taking the non-42703 path.

## Related

- [supabase-schema-evolution.md](../rules/supabase-schema-evolution.md) — DDL conventions, when to add columns
- [evolve-postgres-function.md](evolve-postgres-function.md) — for RPC signature changes
- [backend-type-safety.md](../rules/backend-type-safety.md) — DB row ↔ domain type boundaries
