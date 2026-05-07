import React from 'react';
import {
  ActivityIndicator,
  type AccessibilityState,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, radius, spacing, typography } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  title: string;
  onPress?: () => void;
  variant?: 'accent' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  /** Varsayılan varyant rengini geçersiz kılar (ör. “Kopyalandı” için açık ton) */
  titleColor?: string;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
  testID?: string;
};

export function PillButton({
  title,
  onPress,
  variant = 'accent',
  disabled,
  loading,
  style,
  titleColor,
  accessibilityLabel,
  accessibilityState,
  testID,
}: Props) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bg =
    variant === 'accent'
      ? colors.accent
      : variant === 'danger'
        ? colors.danger
        : 'transparent';
  const border =
    variant === 'ghost' ? { borderWidth: 1, borderColor: colors.border } : {};
  const textColor =
    variant === 'ghost'
      ? colors.text
      : variant === 'accent'
        ? '#0A0A0A'
        : variant === 'danger'
          ? colors.text
          : colors.text;
  const resolvedTitleColor = titleColor ?? textColor;

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      disabled={disabled || loading}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.97);
      }}
      onPressOut={() => {
        scale.value = withSpring(1);
      }}
      style={[styles.base, { backgroundColor: bg }, border, animStyle, style]}
    >
      {loading ? (
        <ActivityIndicator color={resolvedTitleColor} />
      ) : (
        <Text
          style={[typography.subtitle, { color: resolvedTitleColor, fontSize: 15 }]}
          accessibilityLiveRegion="polite"
        >
          {title}
        </Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
});
