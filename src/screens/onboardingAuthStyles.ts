import { StyleSheet } from 'react-native';
import { letterSpacing, radius, spacing, typography } from '../theme';
import { makeStyles } from '../theme/ThemeContext';

export const useOnboardingAuthStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: t.colors.background },
    screen: { flex: 1, backgroundColor: t.colors.background },
    content: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      gap: spacing.xl,
    },
    heroWrap: {
      position: 'relative',
      minHeight: 240,
      borderRadius: radius.card,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: t.colors.pitch.line,
    },
    heroText: {
      position: 'relative',
      zIndex: 1,
      alignItems: 'flex-start',
      gap: spacing.sm,
      padding: spacing.lg,
      paddingBottom: spacing.md,
    },
    brand: {
      ...typography.micro,
      color: t.colors.accent,
      letterSpacing: letterSpacing.brand,
    },
    title: {
      ...typography.headlineStrong,
      color: t.colors.text,
      fontSize: 28,
      letterSpacing: letterSpacing.wide,
    },
    subtitle: {
      ...typography.body,
      color: t.colors.textMuted,
    },
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    label: {
      ...typography.caption,
      color: t.colors.textMuted,
      marginTop: spacing.xs,
    },
    input: {
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 12,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm + 2,
      color: t.colors.text,
      fontFamily: 'Inter_400Regular',
      backgroundColor: t.colors.background,
    },
    passwordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 12,
      backgroundColor: t.colors.background,
      paddingLeft: spacing.sm,
      paddingRight: spacing.xs,
    },
    passwordInputFlex: {
      flex: 1,
      paddingVertical: spacing.sm + 2,
      color: t.colors.text,
      fontFamily: 'Inter_400Regular',
      minHeight: 44,
    },
    passwordToggle: {
      minWidth: 44,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actions: {
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    consent: {
      ...typography.caption,
      color: t.colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.sm,
      lineHeight: 18,
    },
    consentLink: {
      color: t.colors.slate,
      fontFamily: 'Inter_600SemiBold',
      textDecorationLine: 'underline',
    },
    footerLink: {
      ...typography.caption,
      color: t.colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.md,
    },
    footerLinkAccent: {
      color: t.colors.accent,
      fontFamily: 'Inter_600SemiBold',
    },
    forgotPasswordRow: {
      alignSelf: 'flex-end',
      marginTop: spacing.xs,
    },
  }),
);
