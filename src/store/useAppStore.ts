import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Group, GroupMembership, Match, Player } from '../types/domain';
import { buildSeedState, STORE_VERSION } from '../data/seed';
import { mergeStatLines } from './helpers';
import { createAuthSlice } from './slices/authSlice';
import { createGroupsSlice } from './slices/groupsSlice';
import { createMatchesSlice } from './slices/matchesSlice';
import { createPlayersSlice } from './slices/playersSlice';
import type { AppState, RemoteProfileRow } from './types';

export type { AppState, RemoteProfileRow };
export { mergeStatLines };

export const useAppStore = create<AppState>()(
  persist(
    (set, get, api) => ({
      ...createAuthSlice(set, get, api),
      ...createPlayersSlice(set, get, api),
      ...createMatchesSlice(set, get, api),
      ...createGroupsSlice(set, get, api),

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
          matchIdsPendingListEntrance: [],
        });
      },
    }),
    {
      name: 'halisaha-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: STORE_VERSION,
      partialize: (s) => ({
        players: s.players,
        matches: s.matches,
        groups: s.groups,
        groupMemberships: s.groupMemberships,
      }),
      migrate: (persisted: unknown, version: number) => {
        if (version !== STORE_VERSION) {
          const fresh = buildSeedState();
          return { players: fresh.players, matches: fresh.matches, groups: [], groupMemberships: [] };
        }
        return persisted as {
          players: Player[];
          matches: Match[];
          groups: Group[];
          groupMemberships: GroupMembership[];
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) console.warn('persist error', error);
      },
    },
  ),
);
