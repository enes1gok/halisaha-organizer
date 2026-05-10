import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '../../theme';
import { makeStyles } from '../../theme/ThemeContext';
import { maskIban } from '../../utils/iban';
import type { Player } from '../../types/domain';

type Props = {
  player: Player;
};

export function ProfileAccountSection({ player }: Props) {
  const styles = useStyles();

  if (!player.iban) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        Hesap
      </Text>
      <View style={styles.ibanBlock}>
        <Text style={styles.ibanLbl}>IBAN&apos;ım</Text>
        <Text style={styles.ibanVal}>{maskIban(player.iban)}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    section: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.lg,
      gap: spacing.sm,
    },
    sectionTitle: {
      ...typography.subtitle,
      color: t.colors.text,
      marginBottom: spacing.xs,
    },
    ibanBlock: {
      marginTop: spacing.xs,
      gap: 4,
    },
    ibanLbl: {
      ...typography.caption,
      color: t.colors.textMuted,
    },
    ibanVal: {
      ...typography.body,
      color: t.colors.text,
      fontFamily: 'Inter_600SemiBold',
    },
  }),
);
