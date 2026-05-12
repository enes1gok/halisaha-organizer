# Groups and series governance

Apply this rule when working on `GroupsStackNav`, `GroupRole` logic, group admin permissions, group member management, or `GroupWeeklySeries` spawn lifecycle.

## A. Role model

Three-tier hierarchy: `owner > admin > member` — stored in `group_members.role` with a DB CHECK constraint.

**Use DB helpers — do not inline role string comparisons for security-relevant logic:**

| Helper | Purpose | Who can call |
|--------|---------|-------------|
| `public.is_group_admin_or_owner(p_group_id, p_uid)` | `true` if role is `owner` or `admin` | `authenticated` |
| `public.can_manage_group_match(p_match_id, p_uid)` | `true` if organizer of the match OR group owner/admin | `authenticated` |
| `public.kick_group_member(p_group_id, p_target_player_id)` | Kicks a non-owner member | owner or admin |
| `public.set_group_member_role(p_group_id, p_target_player_id, p_new_role)` | Promotes/demotes a member | owner only |

**Invariants:**
- `set_group_member_role` cannot assign `owner` as the new role — owner transfer is not supported via RPC.
- `kick_group_member` cannot kick an owner, even if the caller is an admin.
- New match-mutation RPCs **must** check `can_manage_group_match` — not just `organizer_id = auth.uid()`.
- Client-side role gates (hiding UI elements) may compare `GroupMembership.role` from the store; these are cosmetic only. All security-relevant gates are enforced on the DB side.

Source: [supabase/migrations/20260621120000_group_admin_role_match_permissions.sql](../../supabase/migrations/20260621120000_group_admin_role_match_permissions.sql)

## B. GroupsStackParamList routes (11 total)

Defined in [src/navigation/types.ts](../../src/navigation/types.ts):

```
GroupsMain      — undefined
GroupDetail     — { groupId: string }
GroupWeeklySeries — { groupId: string }
GroupLeaderboard  — { groupId: string }
CreateGroup     — undefined
JoinGroup       — undefined
MatchDetail     — { matchId: string }        (shared with Home/MyMatches stacks)
LineupBuilder   — { matchId: string }        (shared)
MatchPostgame   — { matchId: string }        (shared)
MatchSummary    — { matchId: string }        (shared)
MatchRatings    — { matchId: string }        (shared)
```

Adding a new route: update `GroupsStackParamList` in `types.ts` and register `<Stack.Screen>` in `GroupsStackNav.tsx`.

## C. Weekly series spawn lifecycle

`GroupWeeklySeries` holds one active row per group (`group_weekly_series_group_unique` unique index).

**How spawn works:**
1. `public.submit_match_result(p_match_id)` calls `perform public.spawn_next_weekly_match(p_match_id)` at the end of its transaction body.
2. `spawn_next_weekly_match` is idempotent: `match.spawned_from_match_id` has a unique index — a double-submit cannot produce two child matches.
3. Spawn is only triggered when the finished match has a `series_id` linking it to an active `GroupWeeklySeries` (`is_active = true`). Setting `is_active = false` suppresses future spawns.

**Client-side reads:**
- `Match.seriesId` — links to the originating `group_weekly_series.id`.
- `Match.spawnedFromMatchId` — links to the parent match that triggered the spawn.
- Use these to indicate series continuity in UI (e.g. "Bu maç haftalık serinin parçası").

**Changing spawn behavior:**
- Spawn logic lives inside `submit_match_result` and `spawn_next_weekly_match` in [supabase/migrations/20260511130000_group_weekly_series.sql](../../supabase/migrations/20260511130000_group_weekly_series.sql).
- Signature changes require the `evolve-postgres-function` skill — see [supabase-schema-evolution.md](supabase-schema-evolution.md).
- Do not add a separate client-triggered spawn call; atomicity with score submission is the design invariant.

## D. GroupsDeps injection pattern

New group operations go in `src/usecases/groups.ts` as exported async functions receiving a `GroupsDeps` object. The deps are injected by `buildGroupsUseCaseDeps(set, get)` in `src/store/slices/groupsSlice.ts`. This keeps use-case logic unit-testable without a real Zustand store.

## Review checklist

```
- [ ] Role checks use is_group_admin_or_owner or can_manage_group_match helpers — no inline string comparisons for security
- [ ] New RPCs affecting group members grant EXECUTE to authenticated only (not public/anon)
- [ ] Spawn logic changes go through submit_match_result RPC (atomic — not a separate client call)
- [ ] GroupWeeklySeries.isActive respected before spawning (DB-enforced, verify in spawn function)
- [ ] Client GroupRole type stays aligned with DB CHECK constraint: 'owner' | 'admin' | 'member'
- [ ] New GroupsStack routes added to both GroupsStackParamList and GroupsStackNav.tsx
```

## Related

- Atomic transaction policy: [atomic-mutation-policy.md](atomic-mutation-policy.md)
- Schema evolution (function changes): [supabase-schema-evolution.md](supabase-schema-evolution.md)
- RLS and security: [supabase-governance.md](supabase-governance.md)
- Groups-specific skill: [../skills/add-group-feature.md](../skills/add-group-feature.md)
