# JSONB notification preferences indexing

This note records the JSONB performance decision for
`public.profiles.notification_preferences` and nearby JSONB usage.

## Scope

The app stores notification preferences as a flexible JSONB document:

```sql
public.profiles.notification_preferences jsonb not null default '{}'::jsonb
```

The canonical preference semantics live in
`public.notification_delivery_allowed(p_prefs jsonb, p_delivery_type text)`.
Missing keys default to enabled, and the Edge worker applies quiet-hours at
send time.

Other JSONB usage in the repo falls into three categories:

- RPC input payloads parsed with `jsonb_array_elements`, such as match result
  scorers, assists, own goals, and peer ratings.
- RPC/view response payloads built with `jsonb_agg` and `jsonb_build_object`,
  especially match graph responses.
- Audit snapshots in `audit.row_changes.old_data` and
  `audit.row_changes.new_data`.

None of these current uses filter persisted JSONB columns with containment or
key-existence predicates on the hot path.

## Current query shape

Notification enqueue functions join the candidate rows first, then evaluate the
preference helper:

```sql
from public.group_members gm
join public.push_tokens pt on pt.user_id = gm.player_id
join public.profiles pr on pr.id = gm.player_id
where gm.group_id = new.group_id
  and gm.player_id <> new.organizer_id
  and pt.is_active = true
  and public.notification_delivery_allowed(pr.notification_preferences, 'initial')
```

The current helper reads JSONB paths with `->` inside a `case` expression. A
plain GIN index on the full JSONB document does not make this function call
index-backed.

The Edge worker loads preferences by primary key in batches:

```ts
.from('profiles')
.select('id, notification_preferences')
.in('id', uniq)
```

The `profiles` primary key is the useful access path for that query; a JSONB GIN
index is not relevant there.

## Decision

Do not add a broad GIN index on `profiles.notification_preferences` for the
current notification pipeline.

Expected higher-leverage checks are:

- Candidate set size: group size, attendee count, active token count.
- Join/filter indexes on `group_members`, `push_tokens`, `match_attendees`,
  `matches`, and `notification_deliveries`.
- Queue/history size and retention for `notification_deliveries`.
- CPU cost of `notification_delivery_allowed(...)` only after realistic
  `EXPLAIN (ANALYZE, BUFFERS)` measurements show it is material.

## When to revisit

Revisit this decision when one of these conditions is true:

- SQL starts filtering `notification_preferences` directly with JSONB
  containment, key-existence, or JSONPath predicates.
- Analytics/admin reporting needs to search users by preference fields.
- `EXPLAIN (ANALYZE, BUFFERS)` shows preference evaluation dominates enqueue
  latency after join/filter indexes are healthy.

If direct JSONB containment is added, prefer a targeted GIN index and verify it
is used:

```sql
create index concurrently if not exists profiles_notification_preferences_gin_idx
  on public.profiles using gin (notification_preferences jsonb_path_ops);
```

Use `jsonb_path_ops` for containment-heavy predicates like:

```sql
where notification_preferences @> '{"types":{"group_match_initial":false}}'::jsonb
```

Use default `jsonb_ops` only if the workload needs operators such as `?`, `?|`,
or `?&`.

If enqueue performance is the issue, prefer a query-model change over a broad
JSONB index:

- Generated/stored boolean columns for hot predicates.
- Normalized `profile_notification_type_preferences(user_id, type, enabled)`.
- Partial btree indexes on concrete boolean/type predicates.

Those options make the hot predicates visible to the planner, unlike the
current function call over a JSONB blob.

## Verification

Use `supabase/scripts/explain_notification_preferences.sql` for baseline and
regression checks. Before accepting any JSONB index or model change:

1. Run representative `EXPLAIN (ANALYZE, BUFFERS)` on staging-scale data.
2. Confirm the planner uses the intended index.
3. Compare latency, buffer reads, and row counts before/after.
4. Run `npm run test:rls:sql`.
5. Run Supabase advisors and review unused-index/write-overhead warnings.

Existing pgTAP coverage in `supabase/tests/notification_preferences.test.sql`
must continue to prove:

- Missing preference keys default to enabled.
- Global `push_enabled: false` blocks delivery.
- Per-delivery opt-outs block only the matching delivery type.
- Enqueue functions skip opted-out recipients without changing Edge quiet-hour
  semantics.
