---
name: supabase-governance
description: Supabase tasks playbook for secure auth/RLS decisions, migration hygiene, and query performance checks.
---

# Supabase governance playbook

Use this skill when tasks involve Supabase auth, RLS, migrations, SQL optimization, storage policies, or incident triage.

## Trigger conditions

Apply this skill when a request includes one or more of the following:

- Supabase table/policy/function/view changes
- Auth or JWT claim based authorization design
- New migration, schema refactor, or rollback planning
- Slow query debugging, index strategy, or pagination redesign
- Storage permission setup (upload, update, replace/upsert)
- Production incidents related to RLS/auth/query regressions

## Workflow

1. **Discover context**
   - Identify touched schema objects (tables, views, functions, policies, buckets).
   - Clarify expected role behavior (`anon`, `authenticated`, backend-only flows).

2. **Run risk checks**
   - Security: RLS enabled, no `user_metadata` authz, no client `service_role` exposure.
   - Correctness: policy matrix supports real CRUD paths (`UPDATE` + `SELECT` together).
   - Performance: critical queries and list endpoints have index and pagination strategy.

3. **Propose or implement changes**
   - Keep migration intent focused and reviewable.
   - Avoid mixing unrelated schema and policy changes in one migration when possible.

4. **Verify**
   - Validate role access with positive and negative test cases.
   - Validate query behavior and latency on realistic dataset size.

## Playbook scenarios

### 1) New table with RLS

- Define table and ownership model.
- Enable RLS immediately.
- Add explicit policies per role and operation.
- Add minimal required indexes for expected filters/joins.
- Verify with authenticated and unauthorized access paths.

### 2) Auth claim based authorization

- Store authz-critical claims in trusted server-managed sources (`app_metadata` or relational tables).
- Avoid user-editable claim sources.
- Document token refresh assumptions if claims can become stale.
- Verify deny-by-default behavior.

### 3) Slow list query

- Capture current SQL and latency.
- Run explain/analyze and detect sequential scans, sort hotspots, or N+1 access.
- Add or refine indexes; switch pagination strategy when needed.
- Re-measure latency after changes.

### 4) Storage upsert flow

- Confirm bucket and path policy model.
- Ensure upsert path has `INSERT`, `SELECT`, and `UPDATE` permissions.
- Validate replacement and first upload behavior for intended roles.

### 5) RLS update returns no rows

- Check whether `UPDATE` is paired with `SELECT` policy.
- Confirm policy predicate uses the intended ownership condition.
- Re-test with representative user identities.

## Output expectations

When using this skill, produce:

- A clear risk summary (security, correctness, performance)
- A scoped action list (migration/policy/query changes)
- A verification checklist that can be executed by reviewers

## Related rules

- [`../../rules/supabase-governance.mdc`](../../rules/supabase-governance.mdc)
- [`../../rules/supabase-postgres-performance.mdc`](../../rules/supabase-postgres-performance.mdc)
