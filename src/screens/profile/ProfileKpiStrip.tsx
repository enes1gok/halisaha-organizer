import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFontScale } from '../../hooks/useFontScale';
import { colors, radius, shadows, spacing, typography } from '../../theme';

type Props = {
  matchesPlayed: number;
  goals: number;
  assists: number;
  /** Sunucudan haftalık maç serisi; null ise gösterilmez (çevrimdışı / senkron yok). */
  weeklyMatchStreakEffective?: number | null;
};

export function ProfileKpiStrip({
  matchesPlayed,
  goals,
  assists,
  weeklyMatchStreakEffective,
}: Props) {
  const summary = `${matchesPlayed} maç, ${goals} gol, ${assists} asist${weeklyMatchStreakEffective != null ? `, ${weeklyMatchStreakEffective} haftalık seri` : ''}`;
  const { isHuge } = useFontScale();

  return (
    <View
      style={styles.wrap}
      accessibilityRole="text"
      accessibilityLabel={`Özet istatistikler: ${summary}`}
    >
      <View style={[styles.row, isHuge && styles.rowStacked]}>
        <KpiCell value={matchesPlayed} label="Maç" stacked={isHuge} />
        <View style={isHuge ? styles.dividerHorizontal : styles.divider} />
        <KpiCell value={goals} label="Gol" stacked={isHuge} />
        <View style={isHuge ? styles.dividerHorizontal : styles.divider} />
        <KpiCell value={assists} label="Asist" stacked={isHuge} />
        {weeklyMatchStreakEffective != null && (
          <>
            <View style={isHuge ? styles.dividerHorizontal : styles.divider} />
            <KpiCell
              value={weeklyMatchStreakEffective}
              label="Hafta serisi"
              stacked={isHuge}
            />
          </>
        )}
      </View>
    </View>
  );
}

function KpiCell({
  value,
  label,
  stacked,
}: {
  value: number;
  label: string;
  stacked: boolean;
}) {
  return (
    <View style={[styles.cell, stacked && styles.cellStacked]}>
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
  rowStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  cell: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  cellStacked: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  dividerHorizontal: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
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
