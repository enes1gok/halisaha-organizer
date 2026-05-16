import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { radius, spacing } from '../../theme';
import { makeStyles, useTheme } from '../../theme/ThemeContext';

type Props = {
  reduceMotion: boolean;
};

const STRIPE_COUNT = 14;

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: radius.card,
      overflow: 'hidden',
    },
    stripe: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.045)',
    },
    halfCircle: {
      position: 'absolute',
      alignSelf: 'center',
      bottom: -8,
      width: 140,
      height: 70,
      borderTopLeftRadius: 70,
      borderTopRightRadius: 70,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: t.colors.pitch.line,
      opacity: 0.35,
    },
    centerLine: {
      position: 'absolute',
      left: '50%',
      marginLeft: -0.5,
      top: '10%',
      bottom: '18%',
      width: 1,
      backgroundColor: t.colors.pitch.line,
      opacity: 0.35,
    },
    ballWrap: {
      position: 'absolute',
      right: spacing.md,
      bottom: spacing.md,
    },
    ball: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.5)',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 6,
    },
    ballPatchA: {
      position: 'absolute',
      width: 14,
      height: 14,
      borderRadius: 4,
      backgroundColor: t.colors.surface,
      top: 10,
      left: 8,
      opacity: 0.95,
      transform: [{ rotate: '-18deg' }],
    },
    ballPatchB: {
      position: 'absolute',
      width: 10,
      height: 10,
      borderRadius: 3,
      backgroundColor: t.colors.background,
      bottom: 9,
      right: 10,
      opacity: 0.88,
      transform: [{ rotate: '24deg' }],
    },
  }),
);

export function WelcomePitchBackdrop({ reduceMotion }: Props) {
  const styles = useStyles();
  const { colors: themeColors } = useTheme();
  const float = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      float.value = 0;
      return;
    }
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [reduceMotion, float]);

  const ballMotion = useAnimatedStyle(() => {
    const t = reduceMotion ? 0.5 : float.value;
    const y = (t - 0.5) * 14;
    return {
      transform: [{ translateY: y }],
    };
  });

  return (
    <View
      style={styles.root}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <LinearGradient
        colors={[themeColors.pitch.grassDeep, themeColors.pitch.grassMid, themeColors.pitch.grassLight]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {Array.from({ length: STRIPE_COUNT }).map((_, i) => (
        <View
          key={`stripe-${i}`}
          style={[
            styles.stripe,
            {
              top: `${((i + 1) / (STRIPE_COUNT + 1)) * 100}%`,
            },
          ]}
        />
      ))}

      <View style={styles.halfCircle} />
      <View style={styles.centerLine} />

      <LinearGradient
        colors={[
          'rgba(10, 10, 10, 0.78)',
          'rgba(10, 10, 10, 0.42)',
          'rgba(10, 10, 10, 0.12)',
          'transparent',
        ]}
        locations={[0, 0.35, 0.65, 1]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <Animated.View style={[styles.ballWrap, ballMotion]}>
        <LinearGradient
          colors={['#F2F2F2', themeColors.border]}
          style={styles.ball}
          start={{ x: 0.2, y: 0.15 }}
          end={{ x: 0.85, y: 0.95 }}
        >
          <View style={styles.ballPatchA} />
          <View style={styles.ballPatchB} />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}
