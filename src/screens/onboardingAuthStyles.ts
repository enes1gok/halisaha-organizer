import { StyleSheet } from 'react-native';
import { colors, letterSpacing, radius, spacing, typography } from '../theme';

export const onboardingAuthStyles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },
  hero: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  brand: {
    ...typography.micro,
    color: colors.accent,
    letterSpacing: letterSpacing.brand,
  },
  title: {
    ...typography.headlineStrong,
    color: colors.text,
    fontSize: 28,
    letterSpacing: letterSpacing.wide,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm + 2,
    color: colors.text,
    fontFamily: 'Inter_400Regular',
    backgroundColor: colors.background,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  consent: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  consentLink: {
    color: '#7E8F86',
    fontFamily: 'Inter_600SemiBold',
    textDecorationLine: 'underline',
  },
  footerLink: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  footerLinkAccent: {
    color: colors.accent,
    fontFamily: 'Inter_600SemiBold',
  },
});
