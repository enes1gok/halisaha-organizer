import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { radius, shadows, spacing } from '../theme';
import { makeStyles } from '../theme/ThemeContext';

export function Card({
  children,
  style,
  variant = 'default',
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'glass';
}) {
  const styles = useStyles();
  return <View style={[styles.card, variant === 'glass' ? styles.glass : undefined, style]}>{children}</View>;
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: spacing.md,
      ...shadows.sm,
    },
    glass: {
      backgroundColor: t.colors.surfaceGlass,
      borderColor: t.colors.glassBorder,
    },
  }),
);
