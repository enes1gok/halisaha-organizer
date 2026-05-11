# Testing quality gate

Every meaningful change should include validation proportional to risk.

## Change-to-test matrix

| Change type | Minimum expectation |
|-------------|---------------------|
| Pure helper logic (`src/utils`, `src/store/helpers.ts`) | Unit tests for happy path + edge case(s) |
| Store mutations/selectors (`src/store`) | Unit tests for state transitions and derived values |
| Screen interaction flow (`src/screens`) | Behavior test (or explicit manual test plan if tests are unavailable) |
| Navigation params/route wiring | Route smoke validation and param-shape checks |
| Persistence model changes | Migration scenario validation (old snapshot -> new shape) |

If automated tests are not feasible yet, include a concrete manual verification checklist in PR notes.

## UI quality gate

For new or heavily modified interactives:
- `testID` is present with `{domain}:{component}:{action}` format.
- `accessibilityRole` and `accessibilityLabel` are set.
- Turkish copy consistency is preserved.

## Store/domain quality gate

- State mutation path is deterministic.
- Derived stats/leaderboard impacts are validated.
- No regression on existing match/player/group workflows.

## Release-readiness checklist

```
- [ ] High-risk paths verified (create/join/lineup/score/leaderboard as applicable)
- [ ] Edge cases verified (empty states, invalid ids, duplicate actions)
- [ ] Persist/migrate behavior verified when schema changes
- [ ] testID + accessibility checks completed for interactives
- [ ] Lint/type checks pass for touched files
- [ ] Supabase RPC sync: every supabase.rpc() name/arg changed in src/services/supabase has an applied migration on the target Supabase project (no PGRST202 risk)
```

## Anti-patterns

- "Works on my screen" verification without explicit scenarios.
- Skipping migration validation after persisted shape updates.
- Shipping large refactors without regression smoke checks.
- **Data-fetch N+1:** loading a list then `items.map((id) => fetchOne(id))` (or unbounded `Promise.all` over large lists) instead of a consolidated/batch RPC or bounded concurrency — same guidance as [supabase-postgres-performance.md](supabase-postgres-performance.md).

## Related

- UI conventions and testID format: [ui-ux-design.md](ui-ux-design.md)
- Domain/store implementation quality: [technical-excellence.md](technical-excellence.md)
- Slice migration process: [store-architecture.md](store-architecture.md)
