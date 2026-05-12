import { StyleSheet } from 'react-native';
import { letterSpacing, radius, spacing, typography } from '../../theme';
import { makeStyles, type ThemeColors } from '../../theme/ThemeContext';

function buildSheet(colors: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentContainer: {
      paddingBottom: 0,
    },
    center: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hero: {
      padding: spacing.lg,
      paddingVertical: spacing.xl,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.sm,
    },
    heroDate: {
      ...typography.body,
      color: colors.textMuted,
    },
    heroCd: {
      ...typography.subtitle,
      color: colors.accent,
      marginTop: spacing.sm,
    },
    heroCdCancelled: {
      color: colors.danger,
    },
    cancelBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.danger,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      marginTop: spacing.xs,
    },
    cancelBadgeTxt: {
      ...typography.micro,
      color: colors.text,
      fontWeight: '700' as const,
      letterSpacing: letterSpacing.wide,
    },
    ongoingBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.accentMuted,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      marginTop: spacing.xs,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    ongoingBadgeTxt: {
      ...typography.micro,
      color: colors.accent,
      fontWeight: '700' as const,
      letterSpacing: letterSpacing.wide,
    },
    rsvpLockedBanner: {
      ...typography.caption,
      color: colors.textMuted,
      fontStyle: 'italic' as const,
    },
    heroScore: {
      ...typography.body,
      color: colors.textMuted,
      marginTop: spacing.xs,
    },
    segmentWrap: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    section: {
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.sm,
    },
    sectionTitle: {
      ...typography.caption,
      color: colors.textMuted,
      textTransform: 'uppercase' as const,
      letterSpacing: letterSpacing.wide,
    },
    body: {
      ...typography.body,
      color: colors.text,
    },
    muted: {
      ...typography.caption,
      color: colors.textMuted,
    },
    iban: {
      ...typography.subtitle,
      color: colors.text,
      letterSpacing: letterSpacing.brand,
    },
    rowBetween: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: spacing.sm,
    },
    rowWrap: {
      flexDirection: 'row' as const,
      gap: spacing.sm,
      flexWrap: 'wrap' as const,
    },
    flex: {
      flex: 1,
      minWidth: 120,
    },
    mt: {
      marginTop: spacing.sm,
    },
    mtXs: {
      marginTop: spacing.xs,
    },
    fullRow: {
      width: '100%' as const,
    },
    code: {
      ...typography.subtitle,
      color: colors.accent,
    },
    playerRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    playerMeta: {
      flex: 1,
      gap: spacing.xs,
    },
    badgesRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      flexWrap: 'wrap' as const,
      gap: spacing.xs,
    },
    motmBadge: {
      backgroundColor: colors.accentMuted,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    motmBadgeTxt: {
      ...typography.micro,
      color: colors.accent,
      fontWeight: '600' as const,
    },
    playerName: {
      ...typography.body,
      color: colors.text,
    },
    paidRow: {
      alignItems: 'flex-end' as const,
      gap: spacing.xs,
    },
    micro: {
      ...typography.micro,
      color: colors.textMuted,
    },
    peerHint: {
      marginBottom: spacing.sm,
    },
    draftTag: {
      ...typography.micro,
      color: colors.textMuted,
    },
    pendingRow: {
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.sm,
    },
    row: {
      flexDirection: 'row' as const,
      gap: spacing.sm,
      justifyContent: 'flex-end' as const,
    },
    sheetBg: {
      backgroundColor: colors.surface,
    },
    handle: {
      backgroundColor: colors.border,
    },
    rsvpBody: {
      padding: spacing.lg,
      gap: spacing.sm,
    },
    sheetTitle: {
      ...typography.subtitle,
      color: colors.text,
      marginBottom: spacing.sm,
    },
    emptyText: {
      color: colors.textMuted,
    },
    paymentEditBtn: {
      minWidth: 44,
      minHeight: 44,
      paddingHorizontal: spacing.sm,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    paymentEditLabel: {
      ...typography.caption,
      color: colors.accent,
      fontWeight: '600' as const,
    },
  });
}

/**
 * Tema-bağımlı `MatchDetail` stylesheet üreticisi.
 */
export const useMatchDetailStyles = makeStyles((t) => buildSheet(t.colors));
