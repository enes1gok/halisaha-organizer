import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { makeStyles, useThemeColors } from '../../theme/ThemeContext';

const PARTICLE_COUNT = 10;

type ParticleProps = {
  index: number;
};

function BurstParticle({ index }: ParticleProps) {
  const colors = useThemeColors();
  const palette = useMemo(
    () => [colors.accent, colors.indigo, colors.text, colors.position.MID] as const,
    [colors.accent, colors.indigo, colors.position.MID, colors.text],
  );
  const progress = useSharedValue(0);
  const spread = ((index * 37) % 100) / 100;
  const drift = ((index * 53) % 40) - 20;
  const size = 4 + (index % 3);

  useEffect(() => {
    const delay = index * 28;
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration: 520,
        easing: Easing.out(Easing.quad),
      }),
    );
  }, [index]);

  const startX = spread * 160 - 80;

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.08, 0.92, 1], [0, 1, 0.85, 0]),
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [startX, startX + drift]) },
      { translateY: interpolate(progress.value, [0, 1], [-12, 88]) },
      { rotate: `${interpolate(progress.value, [0, 1], [0, index % 2 === 0 ? 140 : -120])}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          bottom: 44,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: palette[index % palette.length],
        },
        animatedStyle,
      ]}
    />
  );
}

export type IntroFinishBurstProps = {
  /** Burst görünürken true — tek patlama süresi sonunda parent kaldırır */
  visible: boolean;
};

/**
 * Son slayt kutlaması: kısa, tek seferlik mini parçacıklar (reduce motion’da kullanılmaz).
 */
export function IntroFinishBurst({ visible }: IntroFinishBurstProps) {
  const styles = useStyles();

  if (!visible) return null;

  return (
    <View style={styles.host} pointerEvents="none" accessibilityElementsHidden>
      {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
        <BurstParticle key={i} index={i} />
      ))}
    </View>
  );
}

const useStyles = makeStyles(() =>
  StyleSheet.create({
    host: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
  }),
);
