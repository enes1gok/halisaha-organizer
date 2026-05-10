import type { StateCreator } from 'zustand';
import type { AppState, PreferencesSlice, ThemePreference } from '../types';

export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';

export const createPreferencesSlice: StateCreator<AppState, [], [], PreferencesSlice> = (set) => ({
  themePreference: DEFAULT_THEME_PREFERENCE,

  setThemePreference: (preference) => set({ themePreference: preference }),
});
