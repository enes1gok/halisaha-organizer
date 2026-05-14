import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFontScale } from '../../hooks/useFontScale';
import { radius, shadows, spacing, typography } from '../../theme';
import { makeStyles } from '../../theme/ThemeContext';

type Props = {
  matchesPlayed: number;
  goals: number;
  assists: number;
  /** Sunucudan haftalık maç serisi; null ise "—" gösterilir. */
  weeklyMatchStreakEffective?: number | null;
};

export function ProfileKpiStrip({
  matchesPlayed,
  goals,
  assists,
  weeklyMatchStreakEffective,
}: Props) {
  const styles = useKpiStyles();
  const { isHuge } = useFontScale();
  const streakValue = weeklyMatchStreakEffective == null ? '—' : String(weeklyMatchStreakEffective);
  const summary = `${matchesPlayed} maç, ${goals} gol, ${assists} asist, ${streakValue} haftalık seri`;

  if (isHuge) {
    return (
      <View
        style={styles.wrap}
        accessibilityRole="text"
        accessibilityLabel={`Özet istatistikler: ${summary}`}
      >
        <View style={styles.stackedCard}>
          <StackedRow value={matchesPlayed} label="Maç" showDivider />
          <StackedRow value={goals} label="Gol" showDivider />
          <StackedRow value={assists} label="Asist" showDivider />
          <StackedRow value={streakValue} label="Hafta serisi" showDivider={false} />
        </View>
      </View>
    );
  }

  return (
    <View
      style={styles.wrap}
      accessibilityRole="text"
      accessibilityLabel={`Özet istatistikler: ${summary}`}
    >
      <View style={styles.grid}>
        <GridCell value={matchesPlayed} label="Maç" borderRight borderBottom />
        <GridCell value={goals} label="Gol" borderBottom />
        <GridCell value={assists} label="Asist" borderRight />
        <GridCell value={streakValue} label="Hafta serisi" />
      </View>
    </View>
  );
}

function GridCell({
  value,
  label,
  borderRight,
  borderBottom,
}: {
  value: string | number;
  label: string;
  borderRight?: boolean;
  borderBottom?: boolean;
}) {
  const styles = useKpiStyles();
  return (
    <View
      style={[
        styles.cell,
        borderRight && styles.cellBorderRight,
        borderBottom && styles.cellBorderBottom,
      ]}
    >
      <Text style={styles.cellVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {value}
      </Text>
      <Text style={styles.cellLbl}>{label}</Text>
    </View>
  );
}

function StackedRow({
  value,
  label,
  showDivider,
}: {
  value: string | number;
  label: string;
  showDivider: boolean;
}) {
  const styles = useKpiStyles();
  return (
    <>
      <View style={styles.stackedRow}>
        <Text style={styles.stackedLbl}>{label}</Text>
        <Text style={styles.stackedVal}>{value}</Text>
      </View>
      {showDivider && <View style={styles.stackedDivider} />}
    </>
  );
}

const useKpiStyles = makeStyles((t) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      backgroundColor: t.colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: t.colors.border,
      overflow: 'hidden',
      ...shadows.sm,
    },
    cell: {
      width: '50%',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cellBorderRight: {
      borderRightWidth: 1,
      borderRightColor: t.colors.border,
    },
    cellBorderBottom: {
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    cellVal: {
      fontSize: 28,
      fontFamily: 'Inter_900Black',
      color: t.colors.accent,
      lineHeight: 34,
    },
    cellLbl: {
      ...typography.caption,
      color: t.colors.textMuted,
      marginTop: 4,
    },
    stackedCard: {
      backgroundColor: t.colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: t.colors.border,
      overflow: 'hidden',
      ...shadows.sm,
    },
    stackedRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    stackedLbl: {
      ...typography.body,
      color: t.colors.textMuted,
    },
    stackedVal: {
      fontSize: 22,
      fontFamily: 'Inter_700Bold',
      color: t.colors.accent,
    },
    stackedDivider: {
      height: 1,
      backgroundColor: t.colors.border,
      marginHorizontal: spacing.md,
    },
  }),
);
