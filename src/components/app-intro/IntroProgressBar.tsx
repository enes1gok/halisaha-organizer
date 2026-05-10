import React from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { colors, radius } from '../../theme';

export type IntroProgressBarProps = {
  scrollX: SharedValue<number>;
  slideWidth: SharedValue<number>;
  slideCount: number;
  /** 0-based slayt indeksi (erişilebilirlik için) */
  pageIndex: number;
};

export function IntroProgressBar({
  scrollX,
  slideWidth,
  slideCount,
  pageIndex,
}: IntroProgressBarProps) {
  const trackW = useSharedValue(0);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    trackW.value = e.nativeEvent.layout.width;
  };

  const fillStyle = useAnimatedStyle(() => {
    const w = slideWidth.value;
    const tw = trackW.value;
    if (w <= 0 || tw <= 0) {
      return { width: 0 };
    }
    const minP = 1 / slideCount;
    const raw = (scrollX.value / w + 1) / slideCount;
    const p = Math.min(1, Math.max(minP, raw));
    return { width: p * tw };
  });

  return (
    <View
      style={styles.track}
      onLayout={onTrackLayout}
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: slideCount,
        now: pageIndex + 1,
      }}
      accessibilityLabel={`Tanıtım ilerlemesi, slayt ${pageIndex + 1} / ${slideCount}`}
      testID="onboarding:intro:progress"
    >
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    height: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
});
