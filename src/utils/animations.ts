import { Easing as RNAnimatedEasing } from 'react-native';
import { Easing } from 'react-native-reanimated';
import type { WithSpringConfig } from 'react-native-reanimated';

/** Nav transitions must not exceed `normal`; tab horizontal slide uses the same cap (motion-governance). */
export const Durations = {
  fast: 220,
  /** Canonical UI duration cap (navigation + slide transitions). */
  normal: 300,
  /** Same ms as `normal`; kept for existing call sites. */
  standard: 300,
  slow: 400,
} as const;

export const TabSlide = {
  duration: Durations.normal,
} as const;

/** Horizontal stack card transition: JS stack vs native stack (`animationDuration`). */
export const NavDurations = {
  nativeStack: Durations.normal,
  stackCard: Durations.normal,
} as const;

/** Physics-based press feedback — calibrated with legacy `withSpring(0.97)` feel. */
export const Springs = {
  /** Standard softness for interactive `withSpring` (motion-governance). */
  interactive: {
    stiffness: 150,
    damping: 15,
  } satisfies WithSpringConfig,
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

/** RSVP “Gidiyorum” sheet button — fill from center + dismiss hold. */
export const RsvpGoingMotion = {
  minHoldMs: 340,
  fillDuration: 280,
  iconBounceUpPx: 6,
  iconBounceUpMs: 90,
} as const;

/** Reanimated easing presets — prefer these over raw linear `withTiming`. */
export const EasingPresets = {
  /** Tabs, toasts, chrome fades */
  easeOutCubic: Easing.out(Easing.cubic),
  /** Toast enter/exit, overlay fades */
  toastMotion: Easing.out(Easing.cubic),
  /** Skeleton reduce-motion opacity pulse */
  skeletonPulse: Easing.inOut(Easing.ease),
  /** Skeleton shimmer sweep (default motion) */
  skeletonShimmer: Easing.inOut(Easing.ease),
};

/** Horizontal skeleton shimmer loop duration (ms). */
export const SkeletonMotion = {
  shimmerMs: 1400,
  /** Reduce-motion skeleton pulse (ms) */
  pulseMs: 900,
} as const;

/** React Navigation stack uses RN Animated — separate Bezier from Reanimated. */
export const StackTransition = {
  duration: NavDurations.stackCard,
  easing: RNAnimatedEasing.bezier(0.25, 0.1, 0.25, 1),
} as const;
