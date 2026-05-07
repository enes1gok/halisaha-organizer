---
name: add-store-slice
description: Adds or splits a Zustand slice with strong selector patterns and migration-safe persistence.
---

# Add store slice (Halisaha Organizer)

## Use when

- A new domain concern needs dedicated state/actions.
- Existing `useAppStore` logic is growing and should be split by responsibility.
- You need clearer selector APIs for UI performance and readability.

## Mandatory flow

1. Define or update domain contracts in `src/types/domain.ts` when model changes.
2. Create pure helpers in `src/store/helpers.ts` or `src/utils/` if logic is reusable.
3. Add slice file in `src/store/slices/` with explicit `state`, `actions`, `selectors`.
4. Compose/export through `src/store/useAppStore.ts` and `src/store/index.ts`.
5. Evaluate persistence impact (version bump + migrate if persisted shape changes).
6. Update seed data when demo/bootstrap behavior depends on new fields.

## Slice quality rules

- Prefer focused actions with one clear mutation intent.
- Keep selectors query-like and side-effect free.
- Use deterministic defaults for nullable/optional fields.
- Do not embed UI labels/colors in slice state.

## UI consumption rules

- Prefer domain hooks from `src/store/index.ts`.
- Use atomic selectors; use `useShallow` for grouped reads.
- Avoid broad store subscriptions in screens/components.

## Common mistakes to avoid

- Adding new persisted fields without migration coverage.
- Hiding expensive derived computations directly in screen render.
- Re-implementing the same mutation in multiple slices.
- Mixing async side effects and pure derivation in one helper.

## Done checklist

```
- [ ] Types updated where model changed
- [ ] Slice added with clear state/actions/selectors
- [ ] Barrel exports and compose wiring updated
- [ ] Persist version/migrate reviewed and updated if needed
- [ ] Seed and dependent screens validated
- [ ] Basic tests or manual validation notes added
```

## Related

- Store conventions: [`../../rules/store-architecture.mdc`](../../rules/store-architecture.mdc)
- Dependency boundaries: [`../../rules/module-boundaries.mdc`](../../rules/module-boundaries.mdc)
- Domain feature workflow: [`../add-domain-feature/SKILL.md`](../add-domain-feature/SKILL.md)
