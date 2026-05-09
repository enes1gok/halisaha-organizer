import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { Springs } from '../utils/animations';
import { lightImpact } from '../utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const DEFAULT_PRESSED = 0.97;

export type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Visual scale while pressed (1 = no shrink). Default 0.97 */
  pressedScale?: number;
  /** Light haptic on press in */
  hapticOnPress?: boolean;
};

export function PressableScale({
  pressedScale = DEFAULT_PRESSED,
  hapticOnPress = true,
  disabled,
  onPressIn,
  onPressOut,
  style,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const reduceMotion = useReduceMotion();

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole={rest.accessibilityRole ?? 'button'}
      disabled={disabled}
      onPressIn={(e) => {
        if (hapticOnPress && !disabled) void lightImpact();
        if (!reduceMotion) {
          scale.value = withSpring(pressedScale, Springs.interactive);
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reduceMotion) {
          scale.value = withSpring(1, Springs.interactive);
        }
        onPressOut?.(e);
      }}
      style={[style, animStyle]}
      {...rest}
    />
  );
}
