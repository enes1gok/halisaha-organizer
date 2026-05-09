import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors } from '../../theme';
import { EasingPresets } from '../../utils/animations';

type Props = {
  width?: ViewStyle['width'];
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
};

export function SkeletonBlock({
  width = '100%',
  height,
  radius = 8,
  style,
  animated = true,
}: Props) {
  const opacity = useSharedValue(0.7);

  useEffect(() => {
    if (!animated) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(
      withTiming(0.42, { duration: 900, easing: EasingPresets.skeletonPulse }),
      -1,
      true,
    );
  }, [animated, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.base, { width, height, borderRadius: radius }, animatedStyle, style]} />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.border,
  },
});
