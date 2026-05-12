# Realtime and sync governance

Apply this rule when touching `startRemoteRealtimeSync`, `stopRemoteRealtimeSync`, `remoteCatchUp`, `remoteHydrationGate`, `backgroundTask`, or any code that affects how session start/stop coordinates with data freshness.

## A. Realtime channel contract

Single channel `'app-remote-sync'` per session, managed by [src/services/supabase/realtime/syncSubscriptions.ts](../../src/services/supabase/realtime/syncSubscriptions.ts).

**Subscribed tables** (postgres_changes):
- Match graph: `matches`, `match_attendees`, `match_team_players`, `match_stat_lines`, `self_report_requests`
- Group graph: `groups`, `group_members`

**Adding a new subscribed table requires three steps:**
1. Enable the table on the Supabase `supabase_realtime` publication in a migration.
2. Add a handler inside `attachPostgresHandlers()` in `syncSubscriptions.ts`.
3. Decide whether the event triggers a per-ID refresh or a full list hydration (match graph uses per-ID debounce; groups use a shared timer).

**Debounce windows** (do not reduce below 300 ms without profiling — short windows cause rapid successive full hydrations):
- Match graph changes: `MATCH_DEBOUNCE_MS = 320` ms, per `matchId`
- Group changes: `GROUP_DEBOUNCE_MS = 400` ms, shared timer

**Lifecycle rule:** `stopRemoteRealtimeSync()` must be called **before** `resetSupabaseClient()`. Reversing the order can leave a channel subscribed to a torn-down client.

## B. Hydration gate (`src/usecases/remoteHydrationGate.ts`)

Client-side TTL gate that prevents thundering-herd on login and foreground transitions.

| Constant | Value | Meaning |
|----------|-------|---------|
| `MATCH_TTL_MS` | 60 000 ms | Skip `hydrateRemoteMatches` if last success < 60 s ago |
| `GROUP_TTL_MS` | 60 000 ms | Skip `hydrateRemoteGroups` if last success < 60 s ago |
| `HYDRATION_TIMEOUT_MS` | 12 000 ms | Hard timeout per hydration execution |

**Inflight dedup:** a second `hydrateRemoteMatches` / `hydrateRemoteGroups` call within the same TTL window returns the in-progress promise instead of starting a new fetch.

**`force: true`** bypasses the TTL check. Use it on session start and after realtime events that indicate stale data. Do not use it in background polling paths.

**`resetRemoteHydrationGates()`** resets both TTL timestamps. Must be called on sign-out; otherwise stale timestamps survive re-login and delay the first hydration.

## C. Background catch-up (`src/services/sync/`)

**`remoteCatchUp.ts`** — throttle intervals stored in AsyncStorage per reason:

| Reason | Default interval |
|--------|----------------|
| `foreground` | 3 min (180 000 ms) |
| `background` | 60 min (3 600 000 ms) |

Skip conditions (short-circuit before hydration attempt):
1. Supabase client not configured → skip (`supabase_unconfigured`)
2. Store not hydrated → skip (`store_not_hydrated`)
3. Unauthenticated → skip (`unauthenticated`)
4. Throttle interval not elapsed → skip (`throttled`)

**`backgroundTask.ts`** — registers `expo-background-task` with 60-minute minimum interval. Calls `runRemoteCatchUp({ reason: 'background' })`.

## D. Auth context orchestration (`src/context/SupabaseAuthContext.tsx`)

**Sign-in sequence (in order):**
1. `setRemoteUserId(uid)` — auth slice
2. `pushProfileToStore()` — fetches profile from Supabase, syncs to players slice
3. `hydrateRemoteMatches({ force: true })` + `hydrateRemoteGroups({ force: true })` — parallel
4. `registerForPushToken()` → `upsertPushToken(token, 'expo')`
5. `startRemoteRealtimeSync(supabase)` — triggered by session `useEffect`, parallel with steps 2–4

**Sign-out teardown sequence (order matters):**
1. `stopRemoteRealtimeSync()`
2. `resetRemoteHydrationGates()`
3. `deactivatePushToken(token)`
4. `supabase.auth.signOut()`
5. `resetSupabaseClient()`
6. Zustand state cleared (remote matches + groups purged from store)

Violating the teardown order can leave dangling channel subscriptions or stale hydration state on the next login.

## E. Adding new sync behavior

- **New realtime-subscribed table:** follow Section A (3-step checklist).
- **New hydration gate reason:** add a new TTL constant and `lastXxxSuccessAt` ref following the `matches`/`groups` pattern in `remoteHydrationGate.ts`. Call `resetRemoteHydrationGates()` to clear it on sign-out.
- **New background task:** register via `expo-background-task` and store the throttle key in AsyncStorage following the `remoteCatchUp` pattern. Do not start a new background task per user action — background tasks are long-lived OS-managed processes.

## Review checklist

```
- [ ] New realtime-subscribed tables have publication enabled in a migration before attachPostgresHandlers is called
- [ ] Debounce windows not reduced below 300 ms without profiling justification
- [ ] stopRemoteRealtimeSync() called before resetSupabaseClient() in any teardown path
- [ ] resetRemoteHydrationGates() called on sign-out
- [ ] force: true used on session start; not used in background polling paths
- [ ] New catch-up triggers honor the AsyncStorage throttle pattern in remoteCatchUp.ts
```

## Related

- Supabase client security and RLS: [supabase-governance.md](supabase-governance.md)
- Store hydration actions: [store-architecture.md](store-architecture.md)
- Auth context source: [src/context/SupabaseAuthContext.tsx](../../src/context/SupabaseAuthContext.tsx)
- Push notification channel: [notification-governance.md](notification-governance.md)
