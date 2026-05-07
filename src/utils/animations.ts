/**
 * Tab scene horizontal slide (`withTiming` + cubic ease-out in TabSceneTransitionContext).
 * Slightly longer than a typical 300ms so ease-out reads smoothly (matches ajandam).
 */
export const Durations = {
  fast: 220,
  standard: 300,
  slow: 400,
} as const;

export const TabSlide = {
  duration: 420,
} as const;

/** Native stack `animationDuration` (iOS only for several animation types). Android ignores. */
export const NavDurations = {
  nativeStack: 480,
} as const;
