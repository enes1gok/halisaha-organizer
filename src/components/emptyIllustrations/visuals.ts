import { Ionicons } from '@expo/vector-icons';
import type { EmptyStateVariant } from './types';

export type EmptyStateVisual = {
  icon: keyof typeof Ionicons.glyphMap;
  /** Ekran okuyucu için kısa açıklama (hero gizlenmezse) */
  accessibilityLabel: string;
};

export const EMPTY_STATE_VISUALS: Record<EmptyStateVariant, EmptyStateVisual> = {
  generic: {
    icon: 'football-outline',
    accessibilityLabel: 'Boş durum illüstrasyonu',
  },
  matches: {
    icon: 'football-outline',
    accessibilityLabel: 'Maç listesi boş — futbol ikonu',
  },
  matches_upcoming: {
    icon: 'calendar-outline',
    accessibilityLabel: 'Yaklaşan maç yok — takvim ikonu',
  },
  matches_past: {
    icon: 'time-outline',
    accessibilityLabel: 'Geçmiş maç yok — saat ikonu',
  },
  stats: {
    icon: 'podium-outline',
    accessibilityLabel: 'Sıralama verisi yok — podyum ikonu',
  },
  groups: {
    icon: 'people-circle-outline',
    accessibilityLabel: 'Grup yok — kişiler ikonu',
  },
};
