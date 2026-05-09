import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, shadows, spacing } from '../theme';

export function Card({
  children,
  style,
  variant = 'default',
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'glass';
}) {
  return <View style={[styles.card, variant === 'glass' ? styles.glass : undefined, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.sm,
  },
  glass: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.glassBorder,
  },
});
