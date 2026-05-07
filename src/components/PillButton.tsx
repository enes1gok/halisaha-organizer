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
  const borderStyle = variant === 'ghost' ? styles.ghostBorder : undefined;
  const textColor =
    variant === 'ghost'
      ? colors.text
      : variant === 'accent'
        ? colors.background
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
      style={[styles.base, { backgroundColor: bg }, borderStyle, animStyle, style]}
    >
      {loading ? (
        <ActivityIndicator color={resolvedTitleColor} />
      ) : (
        <Text
          style={[styles.title, { color: resolvedTitleColor }]}
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
  ghostBorder: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...typography.subtitle,
    fontSize: 15,
  },
});
