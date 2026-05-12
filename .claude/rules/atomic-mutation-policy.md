# Atomic mutation policy

## Server-side atomicity

- Any write that must touch **multiple tables** consistently must run inside **one** Postgres function (RPC) so it executes as a **single transaction**. Implement as `SECURITY INVOKER` or `SECURITY DEFINER` per [supabase-governance.md](supabase-governance.md).
- Do not implement new multi-step write sequences from the client (e.g. chained `delete` then `insert`, or multiple inserts that must succeed together). Existing legacy patterns must be migrated to an RPC when touched, or the PR must document a justified exception.

## Optimistic updates

- For flows covered above (multi-table or business-critical writes), do **not** apply optimistic Zustand/UI updates until the RPC returns success.
- Single-table operations that are inherently one round-trip (e.g. one `update` on one row) may still optimistic-update after you confirm error handling is acceptable.

## Related

- Schema and triggers for migrated tables: [supabase-schema-evolution.md](supabase-schema-evolution.md).
- New or upgraded RPC workflow: [../skills/add-atomic-rpc.md](../skills/add-atomic-rpc.md).
