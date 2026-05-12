---
name: add-group-feature
description: GroupsStackNav'a yeni ekran veya grup domain mantığı ekler — GroupRole kontrolleri, GroupsStackParamList kaydı, GroupsDeps/usecase pattern, haftalık seri değişikliği, grup RPC. Groups tab'ına yeni route, rol tabanlı UI, veya grup iş kuralı genişletilirken kullan.
---

# Add group feature (Halisaha Organizer)

Use this skill instead of (or alongside) `add-screen` + `add-domain-feature` when the work involves:
- A new screen under `GroupsStackNav`
- Any code that reads or writes `GroupRole`
- Changes to `GroupWeeklySeries` spawn behavior
- A new group-scoped RPC

## Step 1 — Navigation registration

If adding a new screen:
1. Add the route and its params to `GroupsStackParamList` in [../../src/navigation/types.ts](../../src/navigation/types.ts).
2. Register `<Stack.Screen name="..." component={...} />` in [../../src/navigation/GroupsStackNav.tsx](../../src/navigation/GroupsStackNav.tsx).
3. If the screen also appears in `HomeStackNav` or `MyMatchesStackNav` (e.g. `MatchDetail` pattern), register it in each of those stacks too — one implementation, multiple registrations.

Current routes: `GroupsMain`, `GroupDetail`, `GroupWeeklySeries`, `GroupLeaderboard`, `CreateGroup`, `JoinGroup`, `MatchDetail`, `LineupBuilder`, `MatchPostgame`, `MatchSummary`, `MatchRatings`.

## Step 2 — Role and permission model

**Client-side cosmetic gating** (hiding buttons, disabling inputs):
- Read `GroupMembership.role` from the store via `useGroupsStore`.
- Compare against `'owner' | 'admin' | 'member'` inline — this is purely presentational.

**Security-relevant gating** (RPCs, mutations):
- Use DB helpers — do not duplicate role logic in client code or prose error messages.
- `public.is_group_admin_or_owner(group_id, uid)` — owner or admin check.
- `public.can_manage_group_match(match_id, uid)` — organizer or group owner/admin.
- New RPCs that gate on group role must call one of these helpers.

See [../rules/groups-and-series-governance.md](../rules/groups-and-series-governance.md) for the full role invariant table.

## Step 3 — GroupsDeps injection pattern

New group operations go in [../../src/usecases/groups.ts](../../src/usecases/groups.ts) as exported async functions receiving a `GroupsDeps` argument:

```ts
export async function myGroupOperation(
  deps: GroupsDeps,
  params: MyParams
): Promise<void> {
  // call deps.services.*, deps.store.*, etc.
}
```

Wire the function in `src/store/slices/groupsSlice.ts` by adding it to `buildGroupsUseCaseDeps(set, get)`. This keeps the use-case logic unit-testable without a real store.

## Step 4 — Weekly series changes

- **Do not add a separate client-triggered spawn call.** Spawn is always atomic with `submit_match_result` — this is a DB-level design invariant.
- To change spawn timing, frequency, or fields: use the `evolve-postgres-function` skill on `spawn_next_weekly_match` and/or `submit_match_result`.
- UI may read `Match.seriesId` and `Match.spawnedFromMatchId` to show series continuity — these are safe read-only fields.

## Step 5 — New group-scoped RPC

Follow `add-atomic-rpc` skill for the full workflow. Additionally:
- Grant `EXECUTE` to `authenticated` only (same pattern as existing group RPCs).
- Add `is_group_admin_or_owner` or `can_manage_group_match` guard inside the function body.
- Add pgTAP test for the deny path (non-member, non-admin calling the RPC).

## Post-change checklist

```
- [ ] GroupsStackParamList + GroupsStackNav updated (if new screen)
- [ ] Role security checks use DB helpers — not client-side string comparisons
- [ ] New group operations use GroupsDeps injection pattern in usecases/groups.ts
- [ ] Weekly series changes route through submit_match_result RPC (no separate client spawn)
- [ ] New RPCs grant EXECUTE to authenticated only
- [ ] groups-and-series-governance.md review checklist passed
- [ ] testID + accessibility on new interactives
```

## Related

- Group invariants and role model: [../rules/groups-and-series-governance.md](../rules/groups-and-series-governance.md)
- Navigation shell: [../skills/add-screen.md](../skills/add-screen.md)
- New Postgres RPC: [../skills/add-atomic-rpc.md](../skills/add-atomic-rpc.md)
- Domain feature map: [../skills/add-domain-feature.md](../skills/add-domain-feature.md)
- RLS and security: [../rules/supabase-governance.md](../rules/supabase-governance.md)
