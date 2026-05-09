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
} & Pick<TextProps, 'numberOfLines' | 'testID'>;

/**
 * Liste ve detayda aynı tipografi; detayda FadeIn kullanılır.
 */
export function MatchHeroVenueTitle({
  venue,
  variant,
  numberOfLines,
  testID,
}: Props) {
  const lines = numberOfLines ?? (variant === 'list' ? 1 : undefined);
  const text = (
    <Text style={matchVenueTextStyle} numberOfLines={lines} testID={testID}>
      {venue}
    </Text>
  );

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
