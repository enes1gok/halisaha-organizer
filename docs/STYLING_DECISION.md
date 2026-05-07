# Styling Decision

## Decision

Keep the current styling architecture:

- `StyleSheet.create`
- theme tokens in `src/theme/index.ts`
- shared component reuse

No Tailwind/NativeWind rollout at this stage.

## Why

- The project already has a clean token system and consistent dark-theme primitives.
- Pilot review indicates no clear productivity gain for complex screens.
- Introducing a second style paradigm would increase cognitive load and review complexity.

## Enforcement

- Follow `docs/STYLE_GUIDE.md` for all new UI work.
- Use `docs/STYLE_PR_CHECKLIST.md` in UI pull requests.
- Run `npm run lint:styles` before merge to catch raw hex and inline-style violations.

## Revisit Conditions

Re-evaluate NativeWind/Tailwind only if at least one condition is met:

- UI velocity becomes a measurable bottleneck for new screens.
- Team size grows and utility-first conventions become a shared preference.
- Existing style-review churn remains high despite current guardrails.
