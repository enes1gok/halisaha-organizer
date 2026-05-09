import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useAppStore, useMatchesStore } from '../store';
import { Durations, EasingPresets } from '../utils/animations';

type Props = {
  matchId: string;
  children: React.ReactNode;
};

export function MatchCardListRow({ matchId, children }: Props) {
  const reduceMotion = useReduceMotion();
  const pending = useMatchesStore((s) => s.matchIdsPendingListEntrance.includes(matchId));
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(opacity);
    cancelAnimation(translateY);

    if (!pending) {
      opacity.value = 1;
      translateY.value = 0;
      return;
    }

    const clear = () => {
      useAppStore.getState().clearMatchPendingListEntrance(matchId);
    };

    if (reduceMotion) {
      opacity.value = 1;
      translateY.value = 0;
      clear();
      return;
    }

    opacity.value = 0;
    translateY.value = -10;
    opacity.value = withTiming(1, {
      duration: Durations.normal,
      easing: EasingPresets.easeOutCubic,
    }, (finished) => {
      if (finished) runOnJS(clear)();
    });
    translateY.value = withTiming(0, {
      duration: Durations.normal,
      easing: EasingPresets.easeOutCubic,
    });
  }, [matchId, pending, reduceMotion, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[styles.row, animatedStyle]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
  },
});
