import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Group, GroupMembership, Match, MatchTemplate, Player } from '../types/domain';
import { buildSeedState, STORE_VERSION } from '../data/seed';
import { mergeStatLines } from './helpers';
import { createAuthSlice } from './slices/authSlice';
import { createGroupsSlice } from './slices/groupsSlice';
import { createMatchesSlice } from './slices/matchesSlice';
import { createPlayersSlice } from './slices/playersSlice';
import { createMatchTemplatesSlice } from './slices/matchTemplatesSlice';
import { createPreferencesSlice, DEFAULT_THEME_PREFERENCE } from './slices/preferencesSlice';
import type { AppState, RemoteProfileRow, ThemePreference } from './types';

export type { AppState, RemoteProfileRow };
export { mergeStatLines };

type PersistedShape = {
  players: Player[];
  matches: Match[];
  groups: Group[];
  groupMemberships: GroupMembership[];
  themePreference: ThemePreference;
  matchTemplates: MatchTemplate[];
  remoteUserId: string | null;
};

const VALID_PREFERENCES: ReadonlyArray<ThemePreference> = ['system', 'light', 'dark'];

function coerceThemePreference(value: unknown): ThemePreference {
  return VALID_PREFERENCES.includes(value as ThemePreference)
    ? (value as ThemePreference)
    : DEFAULT_THEME_PREFERENCE;
}

function coerceMatchTemplates(value: unknown): MatchTemplate[] {
  return Array.isArray(value) ? (value as MatchTemplate[]) : [];
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get, api) => ({
      ...createAuthSlice(set, get, api),
      ...createPlayersSlice(set, get, api),
      ...createMatchesSlice(set, get, api),
      ...createGroupsSlice(set, get, api),
      ...createPreferencesSlice(set, get, api),
      ...createMatchTemplatesSlice(set, get, api),

      resetToSeed: () => {
        const s = buildSeedState();
        set({
          players: s.players,
          matches: s.matches,
          groups: [],
          groupMemberships: [],
          weeklySeriesByGroupId: {},
          remoteUserId: null,
          matchRatingSummariesById: {},
          matchRatingsSubmissionByMatchId: {},
          scoreVoteTalliesByMatchId: {},
          matchIdsPendingListEntrance: [],
          themePreference: DEFAULT_THEME_PREFERENCE,
          matchTemplates: [],
        });
      },
    }),
    {
      name: 'halisaha-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: STORE_VERSION,
      partialize: (s): PersistedShape => ({
        players: s.players,
        matches: s.matches,
        groups: s.groups,
        groupMemberships: s.groupMemberships,
        themePreference: s.themePreference,
        matchTemplates: s.matchTemplates,
        remoteUserId: s.remoteUserId,
      }),
      migrate: (persisted: unknown, version: number): PersistedShape => {
        if (version < 4) {
          // v3 öncesi rehidrate edilen state'i koru, sadece yeni alanları doldur.
          const safe = (persisted ?? {}) as Partial<PersistedShape>;
          const fresh = buildSeedState();
          return {
            players: safe.players ?? fresh.players,
            matches: safe.matches ?? fresh.matches,
            groups: safe.groups ?? [],
            groupMemberships: safe.groupMemberships ?? [],
            themePreference: coerceThemePreference(safe.themePreference),
            matchTemplates: coerceMatchTemplates(safe.matchTemplates),
            remoteUserId: safe.remoteUserId ?? null,
          };
        }

        const safe = (persisted ?? {}) as Partial<PersistedShape>;
        return {
          players: safe.players ?? [],
          matches: safe.matches ?? [],
          groups: safe.groups ?? [],
          groupMemberships: safe.groupMemberships ?? [],
          themePreference: coerceThemePreference(safe.themePreference),
          matchTemplates: coerceMatchTemplates(safe.matchTemplates),
          remoteUserId: safe.remoteUserId ?? null,
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) console.warn('persist error', error);
        if (state && !VALID_PREFERENCES.includes(state.themePreference)) {
          state.themePreference = DEFAULT_THEME_PREFERENCE;
        }
      },
    },
  ),
);
