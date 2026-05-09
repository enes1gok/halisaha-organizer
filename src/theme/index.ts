import { Platform, StyleSheet } from 'react-native';

export const colors = {
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
  /** “Kopyalandı” gibi kısa geri bildirim metinleri — açık ton */
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
} as const;

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
  micro: { fontSize: 11, fontWeight: '500' as const, fontFamily: 'Inter_600SemiBold' },
};

export const letterSpacing = {
  tight: 0.1,
  normal: 0.3,
  wide: 0.8,
  brand: 1.2,
  code: 1.8,
};

export const gradients = {
  screen: ['#0A0A0A', '#0D1016'] as const,
  surface: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.01)'] as const,
  accent: ['#00D26A', '#8B7BFF'] as const,
};

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
