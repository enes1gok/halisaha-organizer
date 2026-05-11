# Motion governance

## Rules

1. **Navigation duration:** All navigation transitions must not exceed **`Durations.normal` (300 ms)**. Use [`NavDurations`](../../src/utils/animations.ts), [`TabSlide`](../../src/utils/animations.ts), [`StackTransition`](../../src/utils/animations.ts), [`getDefaultNativeStackScreenOptions`](../../src/navigation/defaultNativeStackScreenOptions.ts) (`animationDuration`), and [`getDefaultStackScreenOptions`](../../src/navigation/defaultStackScreenOptions.ts) (`transitionSpec`) rather than ad-hoc durations.

2. **Interactive springs:** When using `withSpring` on interactive elements, **`Springs.interactive`** (`stiffness: 150`, `damping: 15`) is the standard softness preset — see [`Springs`](../../src/utils/animations.ts). Specialized presets (`press`, `snappy`) remain for non-standard cases.

3. **Reduce motion:** When the user has **reduce motion** enabled (`useReduceMotion` from [`useReduceMotion.ts`](../../src/hooks/useReduceMotion.ts)), **slide-based motion** (horizontal stack push, tab scene slide, toast vertical slide) must become **opacity-only** transitions. Implementations: [`getDefaultNativeStackScreenOptions`](../../src/navigation/defaultNativeStackScreenOptions.ts) (`animation: 'fade'`), [`getDefaultStackScreenOptions`](../../src/navigation/defaultStackScreenOptions.ts) (`forFadeFromCenter`), [`AnimatedTabScene`](../../src/navigation/TabSceneTransitionContext.tsx), [`ToastHost`](../../src/components/ToastHost.tsx).

## Cross-links

- UI motion overview: [ui-ux-design.md](ui-ux-design.md)
- Baseline polish: [modern-ui-standards.md](modern-ui-standards.md)
