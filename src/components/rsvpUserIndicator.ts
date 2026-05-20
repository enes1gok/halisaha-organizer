import type { RSVPStatus } from '../types/domain';
import type { ThemeColors } from '../theme/ThemeContext';

type IonGlyph =
  | 'checkmark-circle'
  | 'help-circle-outline'
  | 'close-circle-outline';

/** Sol kenar vurgusu — MatchCard ve HomeUpcomingHeroCard ile aynı semantik. */
export function rsvpStatusLeftBorder(
  status: RSVPStatus,
  colors: ThemeColors,
): { borderLeftColor: string } {
  switch (status) {
    case 'going':
      return { borderLeftColor: colors.accent };
    case 'maybe':
      return { borderLeftColor: colors.position.GK };
    case 'notGoing':
      return { borderLeftColor: colors.danger };
    default:
      return { borderLeftColor: 'transparent' };
  }
}

/** Özet ekranı ve sabit metinler için kısa Türkçe etiket */
export function formatRsvpStatusTr(status: RSVPStatus): string {
  switch (status) {
    case 'going':
      return 'Gidiyorum';
    case 'maybe':
      return 'Belki';
    case 'notGoing':
      return 'Gelmiyorum';
    case 'waitlisted':
      return 'Yedek Listede';
  }
}

export function rsvpStatusIcon(
  status: RSVPStatus,
  colors: ThemeColors,
): { name: IonGlyph; color: string } | null {
  switch (status) {
    case 'going':
      return { name: 'checkmark-circle', color: colors.accent };
    case 'maybe':
      return { name: 'help-circle-outline', color: colors.position.GK };
    case 'notGoing':
      return { name: 'close-circle-outline', color: colors.danger };
    case 'waitlisted':
      return null;
  }
}
