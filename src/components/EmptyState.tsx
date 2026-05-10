import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PillButton } from './PillButton';
import { spacing, typography } from '../theme';
import { makeStyles } from '../theme/ThemeContext';

type Props = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionTestID?: string;
};

export function EmptyState({ title, subtitle, actionLabel, onAction, actionTestID }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>⚽</Text>
      </View>
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
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    icon: {
      fontSize: 36,
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
