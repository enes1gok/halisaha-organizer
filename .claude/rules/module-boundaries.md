# Module boundaries and dependency direction

Keep modules decoupled: place code by responsibility and keep dependencies flowing inward to domain logic.

## Layer responsibilities

| Layer | Primary path | Owns |
|-------|--------------|------|
| UI | `src/screens/`, `src/components/` | Rendering, interaction, navigation wiring |
| Hooks | `src/hooks/` | Reusable view-model logic and screen orchestration |
| State | `src/store/` | Domain state, mutations, persistence boundaries |
| Use cases | `src/usecases/` | Orchestration between store and services; receives injected `*Deps` for testability |
| Domain logic | `src/domain/` | Pure business rules with no React/Zustand dependency (e.g. badge catalog, view-model computation) |
| Domain helpers | `src/store/helpers.ts`, `src/utils/` | Pure calculations, merge logic, data transforms |
| Types | `src/types/` | Shared contracts and enums |

## Dependency direction

Allowed direction (high-level):

`screens/components -> hooks -> store -> usecases -> services/domain/helpers/utils -> types`

Additional allowed edges:
- `screens/components -> store` (when hooks abstraction is unnecessary)
- `screens/components -> domain` (for view-model computation, e.g. `computeBadgeViewModel`)
- `hooks -> utils/types`
- `store -> types`

Forbidden edges:
- `utils` importing React, React Native, navigation, or UI components
- `store` importing from `src/screens/` or `src/components/`
- `types` importing from runtime modules
- `src/domain/` importing React, React Native, Zustand, or navigation
- `src/usecases/` importing from `src/screens/` or `src/components/`

## Placement decisions

- If code needs React hooks or lifecycle, keep it in `screens/` or `hooks/`.
- If logic mutates domain state or persistence, keep it in `store/`.
- If logic orchestrates multiple service calls and needs dependency injection for testability, keep it in `usecases/`.
- If logic is pure and testable with plain inputs/outputs and **used across features**, keep it in `src/domain/{concern}/` (badge-style) or `utils/` / `store/helpers.ts` (utility-style).
- If a helper is only meaningful for one screen, colocate near that screen until reused twice.

## Red flags

- Screen files with long inline business rules, sorting, or merge algorithms.
- Store slices containing presentation-only formatting for labels, colors, or copy.
- Utility files importing `useNavigation`, `useAppStore`, or React components.
- Circular imports between screens, hooks, and store.

## PR checklist

```
- [ ] New logic is placed in the right layer
- [ ] Import direction follows boundary rules
- [ ] Pure logic extracted from UI when non-trivial
- [ ] No UI dependencies leaked into store/utils/types
```

## Related

- Technical quality and selectors: [technical-excellence.md](technical-excellence.md)
- Zustand shape and migration policy: [store-architecture.md](store-architecture.md)
- Screen extraction playbook: [.claude/skills/refactor-screen-to-modules.md](../skills/refactor-screen-to-modules.md)
