import type { StateCreator } from 'zustand';
import { CURRENT_USER_ID } from '../../data/seed';
import type { AppState, AuthSlice } from '../types';

export const createAuthSlice: StateCreator<AppState, [], [], AuthSlice> = (set, get) => ({
  remoteUserId: null,

  setRemoteUserId: (id) => set({ remoteUserId: id }),

  getCurrentUserId: () => get().remoteUserId ?? CURRENT_USER_ID,
});
