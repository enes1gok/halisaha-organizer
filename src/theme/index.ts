import { Platform, StyleSheet } from 'react-native';

export type ColorScheme = 'light' | 'dark';

export const darkColors = {
  background: '#0A0A0A',
  surface: '#1C1C1C',
  surfaceSoft: '#171A1F',
  surfaceGlass: 'rgba(28, 32, 38, 0.78)',
  border: '#2A2A2A',
  glassBorder: 'rgba(165, 184, 214, 0.2)',
  glassHighlight: 'rgba(255, 255, 255, 0.12)',
  text: '#FFFFFF',
  textMuted: '#A3A3A3',
  accent: '#00D26A',
  accentMuted: 'rgba(0, 210, 106, 0.15)',
  slate: '#7C8DA7',
  slateMuted: 'rgba(124, 141, 167, 0.2)',
  indigo: '#8B7BFF',
  indigoMuted: 'rgba(139, 123, 255, 0.2)',
  /** "Kopyalandı" gibi kısa geri bildirim metinleri — açık ton */
  copyFeedbackLight: '#F0FFF7',
  danger: '#FF4D4D',
  position: {
    GK: '#EAB308',
    DEF: '#3B82F6',
    MID: '#22C55E',
    FWD: '#EF4444',
  },
  /** Taktik tahta / yarı saha (koyu tema üzerinde okunaklı çim tonları) */
  pitch: {
    grassDeep: '#0F2418',
    grassMid: '#143028',
    grassLight: '#1A3D32',
    line: 'rgba(255, 255, 255, 0.22)',
    lineStrong: 'rgba(255, 255, 255, 0.38)',
    slotRing: 'rgba(255, 255, 255, 0.35)',
    slotRingGlow: 'rgba(0, 210, 106, 0.55)',
    slotFill: 'rgba(0, 0, 0, 0.18)',
  },
  /** Liderlik tablosu podyum — madalya vurgusu (koyu tema) */
  leaderboard: {
    goldAccent: '#F5C542',
    goldSurface: 'rgba(245, 197, 66, 0.14)',
    goldBorder: 'rgba(245, 197, 66, 0.5)',
    silverAccent: '#C8D4E0',
    silverSurface: 'rgba(200, 212, 224, 0.12)',
    silverBorder: 'rgba(200, 212, 224, 0.42)',
    bronzeAccent: '#CD8F4A',
    bronzeSurface: 'rgba(205, 143, 74, 0.14)',
    bronzeBorder: 'rgba(205, 143, 74, 0.48)',
    placeholderBorder: 'rgba(163, 163, 163, 0.28)',
    placeholderSurface: 'rgba(28, 28, 28, 0.6)',
  },
} as const;

/**
 * Karanlık paletin yapısal şeması; aydınlık palet aynı anahtarları farklı renk
 * değerleriyle uygulayabilsin diye literal tipleri gevşetilmiştir.
 */
export type ColorPalette = {
  [K in keyof typeof darkColors]: (typeof darkColors)[K] extends Record<string, unknown>
    ? { [P in keyof (typeof darkColors)[K]]: string }
    : string;
};

export const lightColors: ColorPalette = {
  background: '#F7F7F8',
  surface: '#FFFFFF',
  surfaceSoft: '#F1F2F4',
  surfaceGlass: 'rgba(255, 255, 255, 0.78)',
  border: '#E4E6EA',
  glassBorder: 'rgba(20, 28, 42, 0.12)',
  glassHighlight: 'rgba(0, 0, 0, 0.04)',
  text: '#0A0A0A',
  textMuted: '#525B68',
  accent: '#00A656',
  accentMuted: 'rgba(0, 166, 86, 0.12)',
  slate: '#4B5563',
  slateMuted: 'rgba(75, 85, 99, 0.14)',
  indigo: '#5D52E5',
  indigoMuted: 'rgba(93, 82, 229, 0.14)',
  /** "Kopyalandı" gibi kısa geri bildirim metinleri — açık tema için koyu yazılır */
  copyFeedbackLight: '#04361F',
  danger: '#DC2626',
  position: {
    GK: '#B45309',
    DEF: '#1D4ED8',
    MID: '#15803D',
    FWD: '#B91C1C',
  },
  /** Taktik tahta / yarı saha (açık tema için doygun ama parlak çim tonları) */
  pitch: {
    grassDeep: '#A6D9B6',
    grassMid: '#BCE3C7',
    grassLight: '#D2EBD8',
    line: 'rgba(15, 36, 24, 0.32)',
    lineStrong: 'rgba(15, 36, 24, 0.5)',
    slotRing: 'rgba(15, 36, 24, 0.38)',
    slotRingGlow: 'rgba(0, 166, 86, 0.45)',
    slotFill: 'rgba(255, 255, 255, 0.55)',
  },
  /** Liderlik tablosu podyum — madalya vurgusu (açık tema) */
  leaderboard: {
    goldAccent: '#B7791F',
    goldSurface: 'rgba(245, 197, 66, 0.22)',
    goldBorder: 'rgba(183, 121, 31, 0.5)',
    silverAccent: '#6B7280',
    silverSurface: 'rgba(200, 212, 224, 0.42)',
    silverBorder: 'rgba(107, 114, 128, 0.42)',
    bronzeAccent: '#9A4F1F',
    bronzeSurface: 'rgba(205, 143, 74, 0.22)',
    bronzeBorder: 'rgba(154, 79, 31, 0.48)',
    placeholderBorder: 'rgba(75, 85, 99, 0.28)',
    placeholderSurface: 'rgba(241, 242, 244, 0.85)',
  },
};

export const palettes = { light: lightColors, dark: darkColors } as const;

/**
 * Geriye dönük uyum için varsayılan dark palet export'u.
 * Yeni veya yeniden yazılan yüzeyler `useTheme()` hook'unu kullanmalıdır.
 */
export const colors = darkColors;

export const radius = {
  card: 16,
  pill: 999,
  sm: 8,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const typography = {
  display: { fontSize: 30, fontWeight: '900' as const, fontFamily: 'Inter_900Black' },
  headlineStrong: { fontSize: 26, fontWeight: '900' as const, fontFamily: 'Inter_900Black' },
  title: { fontSize: 22, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 17, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  body: { fontSize: 15, fontWeight: '400' as const, fontFamily: 'Inter_400Regular' },
  caption: { fontSize: 13, fontWeight: '400' as const, fontFamily: 'Inter_400Regular' },
  micro: { fontSize: 12, fontWeight: '500' as const, fontFamily: 'Inter_600SemiBold' },
};

export const letterSpacing = {
  tight: 0.1,
  normal: 0.3,
  wide: 0.8,
  brand: 1.2,
  code: 1.8,
};

export type GradientPalette = {
  screen: readonly [string, string];
  surface: readonly [string, string];
  accent: readonly [string, string];
};

export const darkGradients: GradientPalette = {
  screen: ['#0A0A0A', '#0D1016'] as const,
  surface: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.01)'] as const,
  accent: ['#00D26A', '#8B7BFF'] as const,
};

export const lightGradients: GradientPalette = {
  screen: ['#F7F7F8', '#EAECEF'] as const,
  surface: ['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.01)'] as const,
  accent: ['#00A656', '#5D52E5'] as const,
};

export const gradientPalettes = { light: lightGradients, dark: darkGradients } as const;

/**
 * Geriye dönük uyum için varsayılan dark gradient export'u.
 * Yeni yüzeyler `useTheme().gradients` kullanmalıdır.
 */
export const gradients = darkGradients;

export const shadows = StyleSheet.create({
  none: {},
  sm: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
    },
    android: { elevation: 4 },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.24,
      shadowRadius: 16,
    },
    android: { elevation: 8 },
    default: {},
  }),
  lg: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.3,
      shadowRadius: 22,
    },
    android: { elevation: 14 },
    default: {},
  }),
});
