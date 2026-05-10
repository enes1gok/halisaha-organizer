import { useAppStore } from '../useAppStore';
import { DEFAULT_THEME_PREFERENCE } from '../slices/preferencesSlice';

describe('preferencesSlice', () => {
  beforeEach(() => {
    useAppStore.setState({ themePreference: DEFAULT_THEME_PREFERENCE });
  });

  it('defaults theme preference to "system"', () => {
    expect(DEFAULT_THEME_PREFERENCE).toBe('system');
    expect(useAppStore.getState().themePreference).toBe('system');
  });

  it('setThemePreference updates the preference to "light"', () => {
    useAppStore.getState().setThemePreference('light');
    expect(useAppStore.getState().themePreference).toBe('light');
  });

  it('setThemePreference updates the preference to "dark"', () => {
    useAppStore.getState().setThemePreference('dark');
    expect(useAppStore.getState().themePreference).toBe('dark');
  });

  it('setThemePreference reverts back to "system"', () => {
    useAppStore.getState().setThemePreference('dark');
    useAppStore.getState().setThemePreference('system');
    expect(useAppStore.getState().themePreference).toBe('system');
  });
});
