# NativeWind Pilot Report

## Scope

- Pilot target: one low-risk surface pattern (`PillButton` + section layout patterns from match detail flow).
- Goal: compare developer ergonomics and token consistency against existing `StyleSheet + theme` approach.
- Constraint: no full migration, no cross-screen rollout.

## Trial Notes

We compared the same UI patterns conceptually in two styles:

1. Existing approach: `StyleSheet.create` + token imports (`colors`, `spacing`, `typography`, `radius`).
2. NativeWind-style utility classes mapped to equivalent visual output.

## Evaluation Matrix

| Criteria | Current Approach | NativeWind Pilot | Notes |
|---|---|---|---|
| Development speed | Good | Good | Similar for simple components |
| Readability | Good | Medium | Class strings become dense in complex conditional UI |
| Token alignment | Strong | Medium | Requires strict class/token mapping discipline |
| Bundle/runtime risk | Low | Medium | New styling runtime/tooling surface |
| Team learning cost | Low | Medium | New conventions and review heuristics needed |

## Outcome

Pilot does not show a decisive benefit over current architecture for this codebase today. Existing token-first strategy remains more predictable for maintainability and review consistency.
