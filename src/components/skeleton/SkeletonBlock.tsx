import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useThemeColors } from '../../theme/ThemeContext';
import { EasingPresets, SkeletonMotion } from '../../utils/animations';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

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
  const colors = useThemeColors();
  const reduceMotion = useReduceMotion();
  const [layoutW, setLayoutW] = useState(0);

  const pulseOpacity = useSharedValue(1);
  const translateX = useSharedValue(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setLayoutW(w);
  }, []);

  const useShimmer = animated && !reduceMotion && layoutW > 0;
  const usePulse = animated && reduceMotion;

  useEffect(() => {
    cancelAnimation(pulseOpacity);
    cancelAnimation(translateX);

    if (!animated) {
      pulseOpacity.value = 1;
      translateX.value = 0;
      return;
    }

    if (reduceMotion) {
      pulseOpacity.value = 0.7;
      pulseOpacity.value = withRepeat(
        withTiming(0.42, {
          duration: SkeletonMotion.pulseMs,
          easing: EasingPresets.skeletonPulse,
        }),
        -1,
        true,
      );
      translateX.value = 0;
      return;
    }

    pulseOpacity.value = 1;

    if (layoutW <= 0) {
      translateX.value = 0;
      return;
    }

    const sweep = layoutW * 2.2;
    translateX.value = -sweep;
    translateX.value = withRepeat(
      withTiming(sweep, {
        duration: SkeletonMotion.shimmerMs,
        easing: EasingPresets.skeletonShimmer,
      }),
      -1,
      false,
    );
  }, [animated, reduceMotion, layoutW, pulseOpacity, translateX]);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: usePulse ? pulseOpacity.value : 1,
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const gradientW = layoutW > 0 ? layoutW * 2.5 : 0;

  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        styles.base,
        { width, height, borderRadius: radius, backgroundColor: colors.border },
        containerAnimatedStyle,
        style,
      ]}
    >
      {useShimmer && gradientW > 0 ? (
        <AnimatedLinearGradient
          colors={['transparent', colors.glassHighlight, 'transparent']}
          locations={[0.35, 0.5, 0.65]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.shimmer, { width: gradientW, height }, shimmerStyle]}
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
