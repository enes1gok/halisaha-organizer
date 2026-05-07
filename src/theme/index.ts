import { StyleSheet } from 'react-native';

export const colors = {
  background: '#0A0A0A',
  surface: '#1C1C1C',
  border: '#2A2A2A',
  text: '#FFFFFF',
  textMuted: '#A3A3A3',
  accent: '#00D26A',
  accentMuted: 'rgba(0, 210, 106, 0.15)',
  /** “Kopyalandı” gibi kısa geri bildirim metinleri — açık ton */
  copyFeedbackLight: '#F0FFF7',
  danger: '#FF4D4D',
  position: {
    GK: '#EAB308',
    DEF: '#3B82F6',
    MID: '#22C55E',
    FWD: '#EF4444',
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
  title: { fontSize: 22, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 17, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  body: { fontSize: 15, fontWeight: '400' as const, fontFamily: 'Inter_400Regular' },
  caption: { fontSize: 13, fontWeight: '400' as const, fontFamily: 'Inter_400Regular' },
  micro: { fontSize: 11, fontWeight: '500' as const, fontFamily: 'Inter_600SemiBold' },
};

export const shadows = StyleSheet.create({
  none: {},
});
