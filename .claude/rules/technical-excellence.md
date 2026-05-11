# Technical excellence and clean code

Standards for `src/`.

## TypeScript standards

- **No `any`:** Prefer precise types from [src/types/domain.ts](../../src/types/domain.ts) and store signatures. If the shape is unknown at compile time, use `unknown` and narrow.
- **Interfaces vs types:** Prefer `interface` for object shapes (component props, store slices). Reserve `type` for unions, mapped types, and utility compositions.
- **Exhaustive unions:** Every `switch` on a discriminated union should end in `default: assertNever(x)` so missing cases become compile errors.

```ts
function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${String(x)}`);
}
```

## Clean code

- **Names:** Prefer `getMatch`, `isLineupLocked`, `canSubmitScore` over vague names like `check`, `data`, `temp`.
- **Function size:** One responsibility per function; aim for roughly **≤ 20 lines** per logical unit. When editing large screens, **extract helpers** instead of growing monoliths.
- **Arguments:** Prefer **0–2 parameters**; for more, use a single **options object** with a named interface.
- **DRY:** Repeated UI + store wiring → **custom hook** in `src/hooks/` when it stabilizes.

## Zustand state access

Use **atomic selectors** with **`useShallow`** from `zustand/react/shallow` when selecting multiple fields. Prefer domain hooks from [src/store/index.ts](../../src/store/index.ts): **`useAuthStore`**, **`usePlayersStore`**, **`useMatchesStore`**, **`useGroupsStore`**. Use **`useAppStore`** only when you need the full store API (e.g. `useAppStore.persist`, `getState()`, `setState()`).

```ts
import { useShallow } from 'zustand/react/shallow';
import { useMatchesStore, usePlayersStore } from '../store';

// Prefer: narrow subscription on the right slice
const match = useMatchesStore((s) => s.getMatch(matchId));
const getPlayer = usePlayersStore((s) => s.getPlayer);

// Prefer: multiple fields from one slice with shallow compare
const { setRSVP, setPaid } = useMatchesStore(
  useShallow((s) => ({ setRSVP: s.setRSVP, setPaid: s.setPaid }))
);

// Avoid in new code: whole store snapshot (forces broad re-renders)
// const store = useAppStore();
```

## Performance (React + RN)

- Use **`useMemo`** for non-trivial derived lists (filter/sort/group matches or players).
- Use **`useCallback`** when passing handlers to **memoized** children or deep lists where it measurably reduces churn.
- Motion: prefer **`react-native-reanimated`** for animated styles and transitions aligned with existing navigation/tab patterns.

## Cross-links

- Architecture: [CLAUDE.md](../../CLAUDE.md).
- Module boundaries: [module-boundaries.md](module-boundaries.md).
- Store architecture specifics: [store-architecture.md](store-architecture.md).
- Store extension workflow: [.claude/skills/add-store-slice.md](../skills/add-store-slice.md).
