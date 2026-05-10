import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { colors, typography } from '../../theme';

const VB_W = 200;
const VB_H = 48;
const PAD = 6;

type Props = {
  points: number[];
};

/** Minimal sparkline for outcome scores in [0, 0.5, 1]. */
export function ProfilePerformanceSparkline({ points }: Props) {
  if (points.length === 0) return null;

  const innerW = VB_W - PAD * 2;
  const innerH = VB_H - PAD * 2;

  const yFor = (p: number) => PAD + (1 - p) * innerH;

  if (points.length === 1) {
    const cy = yFor(points[0]);
    const cx = VB_W / 2;
    return (
      <View
        style={styles.wrap}
        accessibilityRole="image"
        accessibilityLabel={`Son maç performans puanı ${points[0]}`}
      >
        <Svg width="100%" height={VB_H} viewBox={`0 0 ${VB_W} ${VB_H}`}>
          <Circle cx={cx} cy={cy} r={4} fill={colors.accent} />
        </Svg>
      </View>
    );
  }

  const pts = points
    .map((p, i) => {
      const x = PAD + (i / (points.length - 1)) * innerW;
      const y = yFor(p);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <View
      style={styles.wrap}
      accessibilityRole="image"
      accessibilityLabel={`Son ${points.length} maç performans eğrisi`}
    >
      <Svg width="100%" height={VB_H} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <Polyline
          points={pts}
          fill="none"
          stroke={colors.accent}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => {
          const x = PAD + (i / (points.length - 1)) * innerW;
          const y = yFor(p);
          return <Circle key={i} cx={x} cy={y} r={3} fill={colors.accentMuted} stroke={colors.accent} strokeWidth={1} />;
        })}
      </Svg>
    </View>
  );
}

export function ProfileSparklineSection({
  points,
}: {
  points: number[];
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Son 10 maç trendi</Text>
      {points.length === 0 ? (
        <Text style={styles.empty}>Henüz yeterli maç kaydı yok.</Text>
      ) : (
        <ProfilePerformanceSparkline points={points} />
      )}
      <Text style={styles.legend}>G = 1 · B = 0,5 · M = 0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  section: {
    gap: 8,
    marginBottom: 8,
  },
  title: {
    ...typography.caption,
    color: colors.textMuted,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
  },
  legend: {
    ...typography.micro,
    color: colors.textMuted,
  },
});
