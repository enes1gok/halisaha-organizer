# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Halisaha Organizer — Project constitution

Authoritative static context for this repo. Read this file every conversation.

## Commands

```bash
# Run the app (Expo Dev Client required on device/simulator)
npm run start:dev          # start with dev client
npm run start:dev:clear    # start with cleared Metro cache
npm run ios                # build + run on iOS simulator
npm run android            # build + run on Android emulator

# Tests
npm test                   # run all Jest unit tests
npm run test:watch         # watch mode
npm run test:rls:sql       # pgTAP RLS tests (requires: supabase start)
npm run test:rls:integration  # Jest integration tests against local Supabase
npm run test:rls           # both SQL + integration (full RLS suite)

# Lint / style guardrails
npm run lint:styles        # check for hardcoded hex colors and inline styles in changed files

# Supabase local development
npx supabase start         # start local Supabase stack
npx supabase db reset      # reset DB and apply all migrations
npx supabase migration new <name>   # scaffold new migration
eval "$(npx supabase status -o env)"  # export local SUPABASE_URL + keys for integration tests
```

**Run a single test file:**
```bash
npx jest src/store/__tests__/someSlice.test.ts
npx jest --testNamePattern="should compute stats"
```

**RLS integration test env setup** (one-time per shell):
```bash
eval "$(npx supabase status -o env)"
export SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
```

## App identity

| Field | Value |
|--------|--------|
| Display name | Halısaha: Maç Organize Et (Expo `name`) |
| Expo slug | `halisaha-mac-organize-et` |
| UI | Dark mode (`userInterfaceStyle: "dark"`), portrait |
| React Native | New Architecture enabled (`newArchEnabled: true`) |
| Config | [app.json](app.json) |

## Tech stack

- **Runtime**: Expo ~54, React 19, React Native ~0.81, TypeScript.
- **Navigation**: **React Navigation** v7 — root **bottom tabs** + per-tab **stack** navigators. Entry: [AppNavigator.tsx](src/navigation/AppNavigator.tsx). Param lists: [types.ts](src/navigation/types.ts).
- **Styling**: **Design tokens** in [src/theme/index.ts](src/theme/index.ts) (`colors`, `spacing`, `typography`, `radius`, `shadows`) + **`StyleSheet`** in components. No NativeWind / Expo Router.
- **State**: Single **Zustand** store with **persist** (`AsyncStorage`), composed from domain **slices** under [src/store/](src/store/) — entry [useAppStore.ts](src/store/useAppStore.ts), barrel [index.ts](src/store/index.ts) exports **`useAuthStore`**, **`usePlayersStore`**, **`useMatchesStore`**, **`useGroupsStore`**, **`usePreferencesStore`**, **`useMatchTemplatesStore`** (prefer these in UI over raw `useAppStore`). Prefer **atomic selectors** and `useShallow` when selecting multiple fields — avoid subscribing to the full store object in new components.
- **Domain model**: [src/types/domain.ts](src/types/domain.ts) — `Player`, `Match`, `Attendee`, `ScoreResult`, enums (`Position`, `RSVPStatus`, `MatchStatus`, …). Do not duplicate these shapes elsewhere.
- **Data / seed**: [src/data/seed.ts](src/data/seed.ts) (and related) for demo/bootstrap data; `resetToSeed` on the store restores it.

## Directory map

**Navigation** — [src/navigation/](src/navigation/)

| File | Role |
|------|------|
| `AppNavigator.tsx` | `NavigationContainer`, tab navigator, custom tab bar, theme bridge |
| `defaultNativeStackScreenOptions.ts` | Native stack defaults (`getDefaultNativeStackScreenOptions`, reduce-motion fade) |
| `HomeStackNav.tsx` | Home tab stack: home, join, match detail, lineup, score |
| `MyMatchesStackNav.tsx` | Maçlarım stack: list + shared detail/lineup/score screens |
| `ProfileStackNav.tsx` | Profil stack |
| `tabScreensWithTransition.tsx` | Tab scenes wrapped with `AnimatedTabScene` |
| `TabSceneTransitionContext.tsx` | Shared tab transition / animation context |
| `defaultStackScreenOptions.ts` | Stack header defaults (`getDefaultStackScreenOptions`) |

**Screens** — [src/screens/](src/screens/)

Full-screen components (e.g. `HomeScreen`, `MatchDetailScreen`, `LineupBuilderScreen`, `CreateMatchTabScreen`, `LeaderboardScreen`). **Create** and **Leader** tabs render screens directly (no nested stack) via `tabScreensWithTransition.tsx`.

**Shared UI** — [src/components/](src/components/)

Reusable pieces (`Card`, `PillButton`, `MatchCard`, modals, empty states, …).

**Domain logic** — [src/domain/](src/domain/)

Pure business rule modules with no React or Zustand dependency.

| Directory | Role |
|-----------|------|
| `badges/` | Badge catalog (`BADGE_CATALOG`), view-model computation (`computeBadgeViewModel`), local input extraction (`localBadgeInputs`). Consumed by profile screens. Types in `types.ts`, public API via `index.ts`. |

**Use-case layer** — [src/usecases/](src/usecases/)

Orchestration layer between store slices and Supabase services. Receives injected deps for testability.

| File | Role |
|------|------|
| `matches.ts` | All match domain operations (hydrate, create, join, RSVP, lineup, score, ratings). Receives `MatchesDeps` injected by `matchesSlice`. |
| `groups.ts` | All group domain operations (hydrate, create, join, leave, delete, kick, role). Receives `GroupsDeps` injected by `groupsSlice`. |
| `remoteHydrationGate.ts` | Client-side TTL gate (60 s per domain) + inflight dedup + 12 s timeout. `resetRemoteHydrationGates()` called on sign-out. |
| `errors.ts` | `rethrowUseCaseError` — converts service-layer throws to typed `AppError` instances. |

**React context** — [src/context/](src/context/)

| File | Role |
|------|------|
| `SupabaseAuthContext.tsx` | Session lifecycle orchestrator (433 lines): bootstrap with 15 s timeout, PKCE deep-link exchange, profile sync, initial hydration, push token upsert/deactivate, realtime start/stop, sign-out teardown. Exposes `useSupabaseAuth()`. |

**Other** — [src/hooks/](src/hooks/), [src/utils/](src/utils/) (e.g. `id`, `stats`), [src/store/](src/store/).

## Architectural invariants

1. **Navigation types**: Adding a stack screen requires updating the matching `*StackParamList` in [types.ts](src/navigation/types.ts) and registering `Stack.Screen` in the correct navigator.
2. **Single source of truth**: Match and player mutations go through store actions (via domain hooks or **`useAppStore`**); after model changes, keep **`recomputePlayerStatsFromMatches`** / score merge logic consistent with [helpers.ts](src/store/helpers.ts) / [useAppStore.ts](src/store/useAppStore.ts).
3. **Persistence**: Store shape is versioned (`STORE_VERSION`, migrate in `persist`). Changing persisted fields requires a migration or bump strategy.
4. **Copy/i18n**: User-visible strings are currently **Turkish inline** in UI. Error tokens are localized via `src/i18n/` (`ErrorTranslationKey` union → `locales/tr/errors.ts` → `translateError.ts`; see [error-handling-governance.md](.claude/rules/error-handling-governance.md)). General UI strings remain inline until a broader i18n layer is introduced.

## Operational governance

- **Module boundaries** (dependency direction and folder ownership): [.claude/rules/module-boundaries.md](.claude/rules/module-boundaries.md)
- **Store design standards** (slice contract, selectors, migration): [.claude/rules/store-architecture.md](.claude/rules/store-architecture.md)
- **Testing and release quality gates**: [.claude/rules/testing-quality-gate.md](.claude/rules/testing-quality-gate.md)

---

# Rule routing map

`CLAUDE.md` is always active (project constitution). This table routes additional context — read the linked rule file when the task matches.

## When to apply each rule

| You are working on | Read |
|--------------------|------|
| TypeScript, Zustand, hooks, services, performance in `src/` | [.claude/rules/technical-excellence.md](.claude/rules/technical-excellence.md) |
| Modular architecture boundaries, import direction, or folder responsibility decisions | [.claude/rules/module-boundaries.md](.claude/rules/module-boundaries.md) |
| Zustand slice design, selectors, action conventions, persist/migrate changes | [.claude/rules/store-architecture.md](.claude/rules/store-architecture.md) |
| Test strategy, quality gates, test matrix, or release-readiness checks | [.claude/rules/testing-quality-gate.md](.claude/rules/testing-quality-gate.md) |
| UI components, screens, layout, styling, animations | [.claude/rules/ui-ux-design.md](.claude/rules/ui-ux-design.md) |
| Navigation transition timing, Reanimated springs, reduce-motion slide→fade | [.claude/rules/motion-governance.md](.claude/rules/motion-governance.md) |
| Modern mobile UI guardrails: card depth (`elevation`/`shadow`), 44x44 touch targets, animated state transitions | [.claude/rules/modern-ui-standards.md](.claude/rules/modern-ui-standards.md) |
| Supabase auth, RLS, migrations, storage policies, or security-sensitive data access | [.claude/rules/supabase-governance.md](.claude/rules/supabase-governance.md) |
| SQL performance tuning, indexing, or Postgres-backed list/query optimization | [.claude/rules/supabase-postgres-performance.md](.claude/rules/supabase-postgres-performance.md) |
| Schema/migrations: new tables, enums, FK delete/update behavior | [.claude/rules/supabase-schema-evolution.md](.claude/rules/supabase-schema-evolution.md) |
| Postgres function signature/return type changes (42P13), grant re-emission after DROP | [.claude/rules/supabase-schema-evolution.md](.claude/rules/supabase-schema-evolution.md) |
| `src/services/supabase` or DB ↔ domain type boundaries | [.claude/rules/backend-type-safety.md](.claude/rules/backend-type-safety.md) |
| Multi-table writes, RPC transactions, optimistic update ordering | [.claude/rules/atomic-mutation-policy.md](.claude/rules/atomic-mutation-policy.md) |
| Supabase error mapping, `ERR_*` tokens, `mapSupabaseError`, RPC `raise_app_error`, error logging | [.claude/rules/error-handling-governance.md](.claude/rules/error-handling-governance.md) |
| Push queue / `notification_deliveries`, notification Edge Functions, enqueue/drain RPCs, notification pgTAP | [.claude/rules/notification-governance.md](.claude/rules/notification-governance.md) |
| Taktik tahta / Kadro Kur: pitch koordinatları, drop zone ölçümü, swap, haptics, reduce-motion | [.claude/rules/tactical-board-governance.md](.claude/rules/tactical-board-governance.md) |
| Oturum öncesi App Intro, OnboardingNavigator, AuthWelcome, tanıtım görselleri | [.claude/rules/onboarding-governance.md](.claude/rules/onboarding-governance.md) |
| `GroupsStackNav`, `GroupRole` transitions, kick/promote members, `GroupWeeklySeries` spawn lifecycle, group admin permissions | [.claude/rules/groups-and-series-governance.md](.claude/rules/groups-and-series-governance.md) |
| `startRemoteRealtimeSync`, `stopRemoteRealtimeSync`, `remoteCatchUp`, `remoteHydrationGate`, session lifecycle ordering, background sync | [.claude/rules/realtime-sync-governance.md](.claude/rules/realtime-sync-governance.md) |

## Skills

Skills live in `.claude/skills/{name}.md`. Invoke with `/skill-name` or read the file when the trigger applies.

| Skill | Trigger |
|-------|---------|
| `add-screen` | New route/screen, new stack entry, or new tab surface |
| `add-domain-feature` | Extending matches, players, RSVP, lineup, scoring, leaderboard, or store behavior |
| `refactor-screen-to-modules` | A screen is large/coupled and needs extraction into screen + hooks + components + adapters |
| `add-store-slice` | Adding or splitting a Zustand slice with selectors, exports, and migration-safe persistence |
| `supabase-governance` | Supabase auth/RLS/migration/storage/query-performance tasks that need security + operational playbooks |
| `add-atomic-rpc` | New/upgraded Postgres RPC; atomic multi-table writes; migration + RLS/grants + pgTAP |
| `refactor-to-idempotent-logic` | Cron/retry-safe DB logic; idempotent refactor using ON CONFLICT, EXISTS, status guards |
| `debug-supabase-error` | Diagnosing SQLSTATE, RLS, and RPC `ERR_*` / `raise_app_error` failures |
| `add-notification-flow` | New `notification_deliveries` type, enqueue trigger/cron, Edge `buildMessage`, notification pgTAP |
| `evolve-postgres-function` | Postgres function signature/return-type change in a migration; 42P13 / DROP+recreate + grants |
| `add-formation-logic` | New `LineupFormation` in `lineupFormations.ts`, anchors, tests, tactical board behavior |
| `add-group-feature` | New route in `GroupsStackNav`, `GroupRole` logic, `GroupWeeklySeries` change, group-scoped RPC |
| `handle-column-absent-compat` | Multi-query fallback selects a newly-added column that may not exist in the deployed DB (PG 42703); wrap the query with a retry-without-column pattern |

## Maintenance contract

**New rule:** add `.claude/rules/*.md` with a description comment at the top, then add a row to the table above. **New skill:** add `.claude/skills/{name}.md` with `name` + `description` frontmatter, then add a row here.
