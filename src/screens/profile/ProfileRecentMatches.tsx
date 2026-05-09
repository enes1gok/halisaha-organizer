import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';
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

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  muted: {
    ...typography.body,
    color: colors.textMuted,
  },
  rm: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  rmDate: {
    ...typography.caption,
    color: colors.textMuted,
    width: 56,
  },
  rmMid: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  rmTag: {
    ...typography.subtitle,
    width: 24,
    textAlign: 'center',
    color: colors.textMuted,
  },
  win: { color: colors.accent },
  loss: { color: colors.danger },
  rmG: {
    ...typography.caption,
    color: colors.textMuted,
    width: 52,
    textAlign: 'right',
  },
});
