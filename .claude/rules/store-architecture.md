# Store architecture standards

Standards for Zustand slices in `src/store/` to keep state evolution predictable and migration-safe.

## Slice contract

Each slice should expose:
- `state`: serializable domain data
- `actions`: mutating commands (`set`, `create`, `update`, `remove`, `reset`)
- `selectors`: read helpers that encapsulate query logic
- `derived`: computed values only when reused and not UI-specific

Prefer small cohesive slices over one large multi-purpose slice.

## Naming conventions

- Mutations: `setX`, `updateX`, `addX`, `removeX`, `resetX`
- Workflow actions: `submitScore`, `lockLineup`, `approveSelfReport`
- Queries/selectors: `getX`, `findX`, `listX`, `hasX`, `canX`

Do not use vague names like `handleData`, `process`, `doStuff`.

## Selector usage in UI

- Prefer domain hooks from `src/store/index.ts` (`useAuthStore`, `useMatchesStore`, `useGroupsStore`, `usePlayersStore`, `usePreferencesStore`, `useMatchTemplatesStore`).
- Use atomic selectors (`(s) => s.getMatch(id)`) to reduce re-renders.
- When selecting multiple fields from one slice, use `useShallow`.
- Avoid broad subscriptions to entire store objects in new code.
- For code examples with `useShallow` and the full hook list, see [technical-excellence.md](technical-excellence.md).

## Persistence and migrations

When persisted shape changes:
1. Bump store version.
2. Add or update `migrate` logic.
3. Ensure backward compatibility for missing or renamed fields.
4. Keep defaults deterministic for old snapshots.

No silent schema drift in persisted state.

## Side-effect boundaries

- Keep side effects (storage/network/time) at action boundaries.
- Keep helper functions pure (`helpers.ts` / `utils`).
- Avoid mixing formatting/presentation concerns into store actions.

## Anti-patterns

- One action mutating unrelated domains.
- Selectors with hidden side effects.
- UI copy or style tokens embedded in store state.
- Non-serializable objects in persisted slices.

## PR checklist

```
- [ ] Slice API has clear state/actions/selectors boundaries
- [ ] Actions follow naming and single-responsibility rules
- [ ] UI uses atomic selectors and `useShallow` when needed
- [ ] Persist changes include version + migrate handling
- [ ] Helpers remain pure and reusable
```

## Related

- Project-wide TypeScript/store practices: [technical-excellence.md](technical-excellence.md)
- Module dependency boundaries: [module-boundaries.md](module-boundaries.md)
- New slice playbook: [.claude/skills/add-store-slice.md](../skills/add-store-slice.md)
