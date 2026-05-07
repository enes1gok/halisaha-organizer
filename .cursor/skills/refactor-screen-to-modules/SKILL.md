---
name: refactor-screen-to-modules
description: Refactors large screens into modular screen, hooks, components, and adapters with preserved behavior.
---

# Refactor screen to modules (Halisaha Organizer)

## Use when

- A screen is hard to navigate (roughly 250+ lines or multiple responsibilities).
- UI rendering, domain logic, and side effects are mixed together.
- Reuse opportunities exist across screens but code is duplicated.

## Target module shape

For `src/screens/FooScreen.tsx`, prefer:

- `src/screens/FooScreen.tsx` (composition and navigation wiring only)
- `src/screens/Foo/hooks/` (view-model hooks)
- `src/screens/Foo/components/` (presentational pieces)
- `src/screens/Foo/adapters/` (mapping store/domain data to UI-friendly props)

Keep folder optional for small screens; introduce only when complexity justifies it.

## Refactor sequence

1. Freeze behavior: list current user flows and edge cases.
2. Extract pure computations to `adapters` or `src/utils`.
3. Extract screen orchestration/state into `hooks`.
4. Split JSX sections into focused presentational components.
5. Leave screen file as orchestrator: params, hooks, layout assembly.
6. Re-check navigation params, `testID`, and accessibility fields.

## Guardrails

- No business rule duplication between screen and store.
- No React hooks inside adapters.
- Presentational components stay prop-driven (no hidden store reads unless intentional).
- Keep imports aligned with [`module-boundaries.mdc`](../../rules/module-boundaries.mdc).

## Verification checklist

```
- [ ] Before/after user flow behavior matches
- [ ] File responsibilities are clearly separated
- [ ] Derived logic moved to pure units where possible
- [ ] testID and accessibility props preserved
- [ ] Lint and type checks pass
```

## Related

- Route/screen addition workflow: [`../add-screen/SKILL.md`](../add-screen/SKILL.md)
- Domain behavior changes: [`../add-domain-feature/SKILL.md`](../add-domain-feature/SKILL.md)
- Store-level constraints: [`../../rules/store-architecture.mdc`](../../rules/store-architecture.mdc)
