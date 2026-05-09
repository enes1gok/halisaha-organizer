import { Easing as RNAnimatedEasing } from 'react-native';
import { Easing } from 'react-native-reanimated';
import type { WithSpringConfig } from 'react-native-reanimated';

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

/** Horizontal stack (@react-navigation/stack) card transition duration (both platforms). */
export const NavDurations = {
  /** Legacy alias kept for native-stack experimentation notes */
  nativeStack: 480,
  stackCard: 440,
} as const;

/** Physics-based press feedback — calibrated with legacy `withSpring(0.97)` feel. */
export const Springs = {
  press: {
    stiffness: 420,
    damping: 26,
    mass: 0.35,
  } satisfies WithSpringConfig,
  /** Snappier release / drag snap-ups where appropriate */
  snappy: {
    stiffness: 520,
    damping: 32,
    mass: 0.35,
  } satisfies WithSpringConfig,
};

/** Reanimated easing presets — prefer these over raw linear `withTiming`. */
export const EasingPresets = {
  /** Tabs, toasts, chrome fades */
  easeOutCubic: Easing.out(Easing.cubic),
  /** Toast enter/exit, overlay fades */
  toastMotion: Easing.out(Easing.cubic),
  /** Skeleton shimmer pulse */
  skeletonPulse: Easing.inOut(Easing.ease),
};

/** React Navigation stack uses RN Animated — separate Bezier from Reanimated. */
export const StackTransition = {
  duration: NavDurations.stackCard,
  easing: RNAnimatedEasing.bezier(0.25, 0.1, 0.25, 1),
} as const;
