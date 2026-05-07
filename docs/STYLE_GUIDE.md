# Styling Guide

This project uses a token-first styling system for React Native UI. The default approach is:

1. `StyleSheet.create` for static styles.
2. Theme tokens from `src/theme/index.ts` for color, spacing, radius, and typography.
3. Inline styles only for clearly dynamic runtime values.

## Core Principles

- Use `colors`, `spacing`, `radius`, and `typography` from `src/theme/index.ts`.
- Keep visual hierarchy consistent with existing tokens (`text` vs `textMuted`, `title` vs `body`).
- Prefer shared components in `src/components` before creating new local primitives.
- Keep Turkish UI copy consistent with the current product language.

## Required Pattern

- Use `StyleSheet.create` in every screen/component for static style definitions.
- Keep component JSX mostly declarative by moving style literals into style objects.
- Use token-backed values instead of magic numbers when a token already exists.

## Inline Style Rules

Inline style is allowed only when at least one of the following is true:

- Value is computed at runtime and cannot be represented statically.
- Animated style is produced by Reanimated hooks.
- One-off composition is clearer than introducing a throwaway style key.

Inline style is not allowed for:

- Static spacing, color, radius, typography, border, or layout values.
- Repeating style fragments that can live in `StyleSheet.create`.

## Color Rules

- Do not add raw hex values in screens/components.
- Allowed place for raw color values: theme token source (`src/theme/index.ts`).
- When introducing a new visual role, add a token first, then consume that token.

## Do / Don't

Do:

- `style={styles.container}` with `backgroundColor: colors.background`
- `padding: spacing.md`
- `...typography.body`

Don't:

- `style={{ backgroundColor: '#111' }}`
- `style={{ padding: 14 }}`
- `style={{ color: '#fff', fontSize: 15 }}`

## Interaction, Accessibility, Testability

- Interactive controls should expose `testID` using `{domain}:{component}:{action}`.
- Use meaningful `accessibilityRole` and Turkish `accessibilityLabel` for touch targets.
- Keep pressed/active/disabled states visually consistent with existing patterns (`PillButton`, `Card`).

## Pull Request Checklist (Styling)

- Token usage complete (`colors`, `spacing`, `radius`, `typography`).
- Static styles are in `StyleSheet.create`.
- No new raw hex in feature files.
- Inline style usage is justified (dynamic/animated only).
- Existing shared component patterns were reused where possible.
