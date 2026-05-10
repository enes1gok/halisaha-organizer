import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { spacing } from '../../theme';
import { makeStyles, useThemeColors } from '../../theme/ThemeContext';
import type { EmptyStateVariant } from './types';
import { EMPTY_STATE_VISUALS } from './visuals';

const WRAP_SIZE = 72;
const BORDER_RADIUS = 36;
const ICON_SIZE = 36;
/** Dikey “nefes” mesafesi (px) — düşük tutuldu; layout shift yok. */
const FLOAT_TRANSLATE_PX = 3.5;
/** Yarım salınım süresi (ms); tam döngü ≈ 3.2 sn */
const FLOAT_HALF_MS = 1600;

type Props = {
  variant: EmptyStateVariant;
  /** Kök görsel alanı için test kimliği */
  testID?: string;
};

export function EmptyStateHero({ variant, testID }: Props) {
  const styles = useStyles();
  const colors = useThemeColors();
  const reduceMotion = useReduceMotion();
  const visual = EMPTY_STATE_VISUALS[variant];
  const translateY = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(translateY);

    if (reduceMotion) {
      translateY.value = 0;
      return;
    }

    translateY.value = withRepeat(
      withTiming(-FLOAT_TRANSLATE_PX, {
        duration: FLOAT_HALF_MS,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );

    return () => {
      cancelAnimation(translateY);
      translateY.value = 0;
    };
  }, [reduceMotion, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View
      style={styles.iconWrap}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      <Animated.View style={animatedStyle}>
        <Ionicons name={visual.icon} size={ICON_SIZE} color={colors.accent} />
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    iconWrap: {
      width: WRAP_SIZE,
      height: WRAP_SIZE,
      borderRadius: BORDER_RADIUS,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
  }),
);
