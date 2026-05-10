import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '../../theme';
import { makeStyles } from '../../theme/ThemeContext';
import type { Match } from '../../types/domain';
import { formatShortDate } from '../../utils/dates';

export type RecentMatchRow = {
  m: Match;
  outcome: 'W' | 'L' | 'D';
  myGoals: number;
};

type Props = {
  rows: RecentMatchRow[];
};

export function ProfileRecentMatches({ rows }: Props) {
  const styles = useStyles();

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        Son maçlar
      </Text>
      {rows.length === 0 ? (
        <Text style={styles.muted}>Henüz kayıtlı maç yok.</Text>
      ) : (
        rows.map(({ m, outcome, myGoals }) => (
          <View key={m.id} style={styles.rm}>
            <Text style={styles.rmDate}>{formatShortDate(m.startsAt)}</Text>
            <Text style={styles.rmMid}>
              {m.result!.scoreA} — {m.result!.scoreB}
            </Text>
            <Text style={[styles.rmTag, outcome === 'W' && styles.win, outcome === 'L' && styles.loss]}>
              {outcome === 'W' ? 'G' : outcome === 'L' ? 'M' : 'B'}
            </Text>
            <Text style={styles.rmG}>{myGoals} gol</Text>
          </View>
        ))
      )}
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
    muted: {
      ...typography.body,
      color: t.colors.textMuted,
    },
    rm: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
      gap: spacing.sm,
    },
    rmDate: {
      ...typography.caption,
      color: t.colors.textMuted,
      width: 56,
    },
    rmMid: {
      ...typography.body,
      color: t.colors.text,
      flex: 1,
      textAlign: 'center',
    },
    rmTag: {
      ...typography.subtitle,
      width: 24,
      textAlign: 'center',
      color: t.colors.textMuted,
    },
    win: { color: t.colors.accent },
    loss: { color: t.colors.danger },
    rmG: {
      ...typography.caption,
      color: t.colors.textMuted,
      width: 52,
      textAlign: 'right',
    },
  }),
);
