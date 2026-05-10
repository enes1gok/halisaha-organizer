export type {
  AppState,
  CreateGroupResult,
  CreateMatchInput,
  RemoteProfileRow,
  ThemePreference,
} from './types';

export { mergeStatLines } from './helpers';

/**
 * Global Zustand store (persisted). Prefer domain hooks (`useAuthStore`, …) in UI code.
 *
 * @deprecated Import `useAuthStore`, `usePlayersStore`, `useMatchesStore`, or `useGroupsStore` from this module instead of subscribing via `useAppStore`. Imperative calls (`useAppStore.getState()`, `useAppStore.setState()`) remain the supported escape hatch (e.g. session teardown).
 */
export { useAppStore } from './useAppStore';

import { useAppStore } from './useAppStore';
import type {
  AuthSlice,
  GroupsSlice,
  MatchesSlice,
  PlayersSlice,
  PreferencesSlice,
} from './types';

export function useAuthStore<T>(selector: (state: AuthSlice) => T): T {
  return useAppStore((s) => selector(s));
}

export function usePlayersStore<T>(selector: (state: PlayersSlice) => T): T {
  return useAppStore((s) => selector(s));
}

export function useMatchesStore<T>(selector: (state: MatchesSlice) => T): T {
  return useAppStore((s) => selector(s));
}

export function useGroupsStore<T>(selector: (state: GroupsSlice) => T): T {
  return useAppStore((s) => selector(s));
}

export function usePreferencesStore<T>(selector: (state: PreferencesSlice) => T): T {
  return useAppStore((s) => selector(s));
}
