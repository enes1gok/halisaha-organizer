import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { PressableScale } from './PressableScale';
import { letterSpacing, radius, shadows, spacing, typography } from '../theme';
import { makeStyles, useThemeColors } from '../theme/ThemeContext';
import { EasingPresets, RsvpGoingMotion, Springs } from '../utils/animations';

const AnimatedText = Animated.createAnimatedComponent(Text);

type Props = {
  onCommit: () => Promise<void>;
  onSuccess: () => void;
  onError?: (e: unknown) => void;
  testID?: string;
};

const ICON_SIZE = 22;

export function RsvpGoingButton({ onCommit, onSuccess, onError, testID }: Props) {
  const styles = useStyles();
  const colors = useThemeColors();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [committing, setCommitting] = useState(false);
  const fill = useSharedValue(0);
  const iconY = useSharedValue(0);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const fillLayerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fill.value }],
  }));

  const iconWrapStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: iconY.value }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(fill.value, [0, 1], [colors.text, colors.textOnAccent]),
  }));

  const iconGhostStyle = useAnimatedStyle(() => ({
    opacity: 1 - fill.value,
  }));

  const iconAccentStyle = useAnimatedStyle(() => ({
    opacity: fill.value,
  }));

  const runSelectMotion = () => {
    if (reduceMotion) {
      fill.value = 1;
      iconY.value = 0;
      return;
    }
    fill.value = withTiming(1, {
      duration: RsvpGoingMotion.fillDuration,
      easing: EasingPresets.easeOutCubic,
    });
    iconY.value = withSequence(
      withTiming(-RsvpGoingMotion.iconBounceUpPx, {
        duration: RsvpGoingMotion.iconBounceUpMs,
        easing: Easing.out(Easing.quad),
      }),
      withSpring(0, Springs.snappy),
    );
  };

  const resetMotion = () => {
    if (reduceMotion) {
      fill.value = 0;
      iconY.value = 0;
      return;
    }
    fill.value = withTiming(0, { duration: 120, easing: Easing.out(Easing.cubic) });
    iconY.value = 0;
  };

  const handlePress = async () => {
    if (committing) return;
    setCommitting(true);
    runSelectMotion();
    const hold = new Promise<void>((r) => setTimeout(r, RsvpGoingMotion.minHoldMs));
    try {
      await Promise.all([onCommit(), hold]);
      onSuccess();
    } catch (e) {
      resetMotion();
      onError?.(e);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="Gidiyorum"
      disabled={committing}
      onPress={() => void handlePress()}
      pressedScale={0.95}
      style={styles.pressable}
    >
      <View style={styles.clip}>
        <Animated.View style={[styles.fillLayer, fillLayerStyle]} />
        <Animated.View style={[styles.row, iconWrapStyle]}>
          <View style={styles.iconSlot}>
            <Animated.View style={[styles.iconLayer, iconGhostStyle]} pointerEvents="none">
              <Ionicons name="checkmark-circle" size={ICON_SIZE} color={colors.text} />
            </Animated.View>
            <Animated.View style={[styles.iconLayer, iconAccentStyle]} pointerEvents="none">
              <Ionicons name="checkmark-circle" size={ICON_SIZE} color={colors.textOnAccent} />
            </Animated.View>
          </View>
          <AnimatedText style={[styles.title, labelStyle]} accessibilityLiveRegion="polite">
            Gidiyorum
          </AnimatedText>
        </Animated.View>
      </View>
    </PressableScale>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    pressable: {
      borderRadius: radius.pill,
      ...shadows.sm,
    },
    clip: {
      borderRadius: radius.pill,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: 'transparent',
      minHeight: 48,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    fillLayer: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: t.colors.accent,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    iconSlot: {
      width: ICON_SIZE,
      height: ICON_SIZE,
    },
    iconLayer: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      ...typography.subtitle,
      fontSize: 15,
      letterSpacing: letterSpacing.normal,
    },
  }),
);
