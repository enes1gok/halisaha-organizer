import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, shadows, spacing, typography } from '../../theme';

type Props = {
  reduceMotion: boolean;
};

const BAR_COUNT = 5;
const BAR_MAX = 72;

export function StatsLeaderboardHero({ reduceMotion }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.15, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [reduceMotion, progress]);

  return (
    <View style={styles.wrap} accessibilityRole="image" accessibilityLabel="Oyuncu kartı ve istatistik grafiği önizlemesi">
      <LinearGradient
        colors={[colors.surface, colors.surfaceSoft]}
        style={[styles.playerCard, shadows.md]}
      >
        <View style={styles.avatar} />
        <View style={styles.playerMeta}>
          <Text style={styles.playerName}>Sen</Text>
          <Text style={styles.playerHint}>Maç sonu oylar · Form grafiği</Text>
        </View>
        <View style={styles.spark}>
          <Text style={styles.sparkText}>★</Text>
        </View>
      </LinearGradient>

      <View style={styles.chart}>
        {Array.from({ length: BAR_COUNT }).map((_, i) => (
          <Bar key={i} index={i} progress={progress} reduceMotion={reduceMotion} />
        ))}
      </View>
    </View>
  );
}

function Bar({
  index,
  progress,
  reduceMotion,
}: {
  index: number;
  progress: SharedValue<number>;
  reduceMotion: boolean;
}) {
  const targetHeight = 22 + ((index + 2) * 10) % BAR_MAX;
  const style = useAnimatedStyle(() => {
    const t = reduceMotion ? 1 : progress.value;
    const h = 12 + (targetHeight - 12) * t;
    return { height: h };
  });

  return (
    <View style={styles.barTrack}>
      <Animated.View
        style={[
          styles.barFill,
          {
            backgroundColor: index === BAR_COUNT - 1 ? colors.accent : colors.indigoMuted,
          },
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentMuted,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  playerMeta: {
    flex: 1,
    gap: spacing.xs,
  },
  playerName: {
    ...typography.subtitle,
    color: colors.text,
  },
  playerHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  spark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.indigoMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkText: {
    fontSize: 18,
    color: colors.indigo,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 88,
    width: '100%',
    maxWidth: 280,
  },
  barTrack: {
    width: 28,
    height: BAR_MAX,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: radius.sm,
    minHeight: 12,
  },
});
