import React from 'react';
import { Text, type TextProps } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useFontScale } from '../hooks/useFontScale';
import { letterSpacing, typography } from '../theme';
import { makeStyles } from '../theme/ThemeContext';
import { Durations, EasingPresets } from '../utils/animations';

type Props = {
  venue: string;
  variant: 'list' | 'detail';
} & Pick<TextProps, 'numberOfLines' | 'testID'>;

const useVenueStyles = makeStyles((t) => ({
  venueText: {
    ...typography.subtitle,
    color: t.colors.text,
    letterSpacing: letterSpacing.normal,
  },
}));

/**
 * Liste ve detayda aynı tipografi; detayda FadeIn kullanılır.
 */
export function MatchHeroVenueTitle({
  venue,
  variant,
  numberOfLines,
  testID,
}: Props) {
  const styles = useVenueStyles();
  const { isLarge } = useFontScale();
  const defaultListLines = isLarge ? 2 : 1;
  const lines = numberOfLines ?? (variant === 'list' ? defaultListLines : undefined);
  const text = (
    <Text style={styles.venueText} numberOfLines={lines} testID={testID}>
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
