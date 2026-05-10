import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { colors, radius, spacing, typography } from '../../theme';
import type { Player } from '../../types/domain';
import { ProfileSparklineSection } from './ProfilePerformanceSparkline';

type Props = {
  player: Player;
  winRatePct: number;
  winStreak: number;
  levelLabel: string;
  tierProgress01: number;
  compositeScore: number;
  sparklinePoints: number[];
};

export function ProfilePerformanceCard({
  player,
  winRatePct,
  winStreak,
  levelLabel,
  tierProgress01,
  compositeScore,
  sparklinePoints,
}: Props) {
  const { wins, losses, draws } = player.stats;
  const ratingAvg = player.stats.ratingAverage100;
  const voteCount = player.stats.ratingVoteCount ?? 0;
  const motmCount = player.stats.motmCount ?? 0;

  return (
    <View style={styles.outer}>
      <Card variant="glass" style={styles.card}>
        <Text style={styles.cardTitle}>Performans</Text>

        <View style={styles.levelRow}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelTxt}>{levelLabel}</Text>
          </View>
          <Text style={styles.scoreHint}>Skor {compositeScore}</Text>
        </View>
        <View
          style={styles.progressTrack}
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(tierProgress01 * 100),
          }}
        >
          <View style={[styles.progressFill, { width: `${Math.round(tierProgress01 * 100)}%` }]} />
        </View>

        <ProfileSparklineSection points={sparklinePoints} />

        <View style={styles.metrics}>
          <MetricRow label="Galibiyet oranı" value={`${winRatePct}%`} />
          <MetricRow label="G — M — B" value={`${wins} — ${losses} — ${draws}`} />
          {winStreak > 0 ? (
            <MetricRow label="Seri" value={`${winStreak} galibiyet`} />
          ) : null}
          <MetricRow
            label="Topluluk oyu (ortalama)"
            value={
              ratingAvg != null
                ? `${ratingAvg.toFixed(1)}${voteCount > 0 ? ` (${voteCount} oy)` : ''}`
                : '—'
            }
            hint={ratingAvg == null ? 'Maç sonrası oylamalarla dolar.' : undefined}
          />
          <MetricRow label="Maçın adamı" value={String(motmCount)} />
        </View>
      </Card>
    </View>
  );
}

function MetricRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.metricBlock}>
      <Text style={styles.metricLbl}>{label}</Text>
      <Text style={styles.metricVal}>{value}</Text>
      {hint ? <Text style={styles.metricHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  card: {
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  levelBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  levelTxt: {
    ...typography.micro,
    color: colors.accent,
    fontFamily: 'Inter_600SemiBold',
  },
  scoreHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  metrics: {
    marginTop: spacing.xs,
    gap: spacing.md,
  },
  metricBlock: {
    gap: 2,
  },
  metricLbl: {
    ...typography.caption,
    color: colors.textMuted,
  },
  metricVal: {
    ...typography.body,
    color: colors.text,
    fontFamily: 'Inter_600SemiBold',
  },
  metricHint: {
    ...typography.micro,
    color: colors.textMuted,
    marginTop: 2,
  },
});
