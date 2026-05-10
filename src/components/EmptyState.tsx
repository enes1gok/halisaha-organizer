import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '../theme';
import { makeStyles } from '../theme/ThemeContext';
import { EmptyStateHero } from './emptyIllustrations/EmptyStateHero';
import type { EmptyStateVariant } from './emptyIllustrations/types';
import { PillButton } from './PillButton';

type Props = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionTestID?: string;
  /** Boş durum görseli; varsayılan genel maç / futbol sembolü */
  variant?: EmptyStateVariant;
  /** Görsel daire için test kimliği */
  heroTestID?: string;
};

export function EmptyState({
  title,
  subtitle,
  actionLabel,
  onAction,
  actionTestID,
  variant = 'matches',
  heroTestID,
}: Props) {
  const styles = useStyles();
  return (
    <View style={styles.wrap}>
      <EmptyStateHero variant={variant} testID={heroTestID ?? 'emptyState:hero'} />
      <Text style={[typography.subtitle, styles.title]}>{title}</Text>
      {subtitle ? (
        <Text style={[typography.body, styles.sub]}>{subtitle}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <PillButton
          title={actionLabel}
          onPress={onAction}
          style={styles.btn}
          testID={actionTestID}
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    wrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.lg,
    },
    title: {
      color: t.colors.text,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    sub: {
      color: t.colors.textMuted,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    btn: {
      marginTop: spacing.sm,
    },
  }),
);
