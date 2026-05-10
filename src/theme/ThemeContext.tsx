import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { usePreferencesStore } from '../store';
import type { ThemePreference } from '../store/types';
import {
  darkColors,
  darkGradients,
  gradientPalettes,
  palettes,
  type ColorPalette,
  type ColorScheme,
  type GradientPalette,
} from './index';

export type ThemeColors = ColorPalette;

export type ThemeValue = {
  scheme: ColorScheme;
  preference: ThemePreference;
  colors: ThemeColors;
  gradients: GradientPalette;
};

const FALLBACK_THEME: ThemeValue = {
  scheme: 'dark',
  preference: 'system',
  colors: darkColors,
  gradients: darkGradients,
};

const ThemeContext = createContext<ThemeValue>(FALLBACK_THEME);

/**
 * Tema tercihini sistem şemasıyla birleştirip etkin şemayı döndürür.
 *
 * Kurallar:
 *  - `preference !== 'system'` → tercih aynen kullanılır.
 *  - `preference === 'system'` ve sistem `'light'` → `'light'`.
 *  - Aksi tüm durumlarda (`null`/`undefined`/`'dark'`) → `'dark'`.
 */
export function resolveColorScheme(
  preference: ThemePreference,
  systemScheme: 'light' | 'dark' | null | undefined,
): ColorScheme {
  if (preference !== 'system') return preference;
  return systemScheme === 'light' ? 'light' : 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const preference = usePreferencesStore((s) => s.themePreference);

  const value = useMemo<ThemeValue>(() => {
    const resolved = resolveColorScheme(preference, systemScheme);
    return {
      scheme: resolved,
      preference,
      colors: palettes[resolved],
      gradients: gradientPalettes[resolved],
    };
  }, [preference, systemScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

export function useThemeColors(): ThemeColors {
  return useContext(ThemeContext).colors;
}

/**
 * Tema-bağımlı stylesheet üretir. Tema değiştiğinde otomatik yeniden hesaplanır.
 *
 * Kullanım:
 *   const useStyles = makeStyles((t) => ({
 *     screen: { backgroundColor: t.colors.background },
 *   }));
 *
 *   function MyScreen() {
 *     const styles = useStyles();
 *     ...
 *   }
 */
export function makeStyles<T extends Record<string, unknown>>(
  factory: (theme: ThemeValue) => T,
): () => T {
  return function useGeneratedStyles() {
    const theme = useTheme();
    return useMemo(() => factory(theme), [theme]);
  };
}
