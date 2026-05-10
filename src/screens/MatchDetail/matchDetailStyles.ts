import { StyleSheet } from 'react-native';
import { colors, letterSpacing, radius, spacing, typography } from '../../theme';

export const matchDetailStyles = StyleSheet.create({
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
    fontWeight: '700',
    letterSpacing: letterSpacing.wide,
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
    textTransform: 'uppercase',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowWrap: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
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
    width: '100%',
  },
  code: {
    ...typography.subtitle,
    color: colors.accent,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
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
    fontWeight: '600',
  },
  playerName: {
    ...typography.body,
    color: colors.text,
  },
  paidRow: {
    alignItems: 'flex-end',
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
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentEditLabel: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  rsvpSecondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  rsvpSecondaryLabel: {
    ...typography.subtitle,
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
});
