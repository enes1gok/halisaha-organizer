import { SharedTransition } from 'react-native-reanimated';
import { NavDurations } from './animations';

/** Aligns hero shared-element motion with native-stack push duration (see `defaultNativeStackScreenOptions`). */
export const matchHeroSharedTransition = SharedTransition.duration(NavDurations.nativeStack).springify();

export function matchHeroVenueSharedTag(matchId: string) {
  return `match-${matchId}-venue`;
}

export function matchHeroDateSharedTag(matchId: string) {
  return `match-${matchId}-date`;
}
