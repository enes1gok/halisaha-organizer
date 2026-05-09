import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadows, spacing, typography } from '../../theme';

type Props = {
  matchesPlayed: number;
  goals: number;
  assists: number;
};

export function ProfileKpiStrip({ matchesPlayed, goals, assists }: Props) {
  const summary = `${matchesPlayed} maç, ${goals} gol, ${assists} asist`;

  return (
    <View
      style={styles.wrap}
      accessibilityRole="text"
      accessibilityLabel={`Özet istatistikler: ${summary}`}
    >
      <View style={styles.row}>
        <KpiCell value={matchesPlayed} label="Maç" />
        <View style={styles.divider} />
        <KpiCell value={goals} label="Gol" />
        <View style={styles.divider} />
        <KpiCell value={assists} label="Asist" />
      </View>
    </View>
  );
}

function KpiCell({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
        {value}
      </Text>
      <Text style={styles.cellLbl}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cell: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  cellVal: {
    ...typography.title,
    color: colors.accent,
  },
  cellLbl: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
  },
});
