import React from 'react';
import { Text, type TextProps } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, letterSpacing, typography } from '../theme';
import { Durations, EasingPresets } from '../utils/animations';

/** Shared title styling for list ↔ detail continuity (Maç kartı / Maç detayı). */
export const matchVenueTextStyle = {
  ...typography.subtitle,
  color: colors.text,
  letterSpacing: letterSpacing.normal,
};

type Props = {
  venue: string;
  variant: 'list' | 'detail';
  sharedTransitionTag?: string;
  sharedTransitionStyle?: SharedTransitionStyle;
} & Pick<TextProps, 'numberOfLines' | 'testID'>;

type SharedTransitionStyle = NonNullable<
  React.ComponentProps<typeof Animated.View>['sharedTransitionStyle']
>;

/**
 * Liste ve detayda aynı tipografi; paylaşımlı öğe geçişi yoksa detayda FadeIn kullanılır.
 */
export function MatchHeroVenueTitle({
  venue,
  variant,
  numberOfLines,
  testID,
  sharedTransitionTag,
  sharedTransitionStyle,
}: Props) {
  const lines = numberOfLines ?? (variant === 'list' ? 1 : undefined);
  const text = (
    <Text style={matchVenueTextStyle} numberOfLines={lines} testID={testID}>
      {venue}
    </Text>
  );

  if (sharedTransitionTag) {
    return (
      <Animated.View
        sharedTransitionTag={sharedTransitionTag}
        sharedTransitionStyle={sharedTransitionStyle}
      >
        {text}
      </Animated.View>
    );
  }

  if (variant === 'detail') {
    return (
      <Animated.View
        entering={FadeIn.duration(Durations.standard).easing(EasingPresets.toastMotion)}
      >
        {text}
      </Animated.View>
    );
  }

  return text;
}
