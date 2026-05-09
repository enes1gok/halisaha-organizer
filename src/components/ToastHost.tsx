import React, { useCallback, useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ShowToastOptions, ToastVariant } from '../context/toastTypes';
import {
  TAB_BAR_FLOAT_MARGIN_BOTTOM,
  TAB_BAR_FLOATING_BLOCK_HEIGHT,
} from '../navigation/tabBarLayout';
import { colors, radius, shadows, spacing, typography } from '../theme';
import { EasingPresets } from '../utils/animations';

const SLIDE = 110;
const ENTER_MS = 280;
const EXIT_MS = 220;

function defaultDuration(opts: ShowToastOptions): number {
  if (opts.durationMs != null) return opts.durationMs;
  return opts.variant === 'warning' ? 5500 : 3800;
}

type ToastEntry = {
  payload: ShowToastOptions;
  id: number;
};

type Props = {
  entry: ToastEntry | null;
  /** Clears host state only if still showing this toast id (avoids races). */
  onConsumed: (requestId: number) => void;
};

export function ToastHost({ entry, onConsumed }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(SLIDE);
  const opacity = useSharedValue(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bottomOffset =
    TAB_BAR_FLOAT_MARGIN_BOTTOM + Math.max(insets.bottom, 8) + TAB_BAR_FLOATING_BLOCK_HEIGHT + spacing.sm;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const finishDismiss = useCallback(
    (payload: ShowToastOptions, requestId: number) => {
      payload.onDismiss?.();
      onConsumed(requestId);
    },
    [onConsumed],
  );

  useEffect(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (!entry) {
      translateY.value = SLIDE;
      opacity.value = 0;
      return;
    }

    const { payload, id: requestId } = entry;
    const announce = `${payload.title}${payload.message ? `. ${payload.message}` : ''}`;
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(announce);
    }

    translateY.value = SLIDE;
    opacity.value = 0;
    translateY.value = withTiming(0, {
      duration: ENTER_MS,
      easing: EasingPresets.toastMotion,
    });
    opacity.value = withTiming(1, {
      duration: ENTER_MS,
      easing: EasingPresets.toastMotion,
    });

    const duration = defaultDuration(payload);
    hideTimerRef.current = setTimeout(() => {
      translateY.value = withTiming(
        SLIDE,
        { duration: EXIT_MS, easing: EasingPresets.toastMotion },
        (finished) => {
          if (finished) {
            runOnJS(finishDismiss)(payload, requestId);
          }
        },
      );
      opacity.value = withTiming(0, {
        duration: EXIT_MS,
        easing: EasingPresets.toastMotion,
      });
    }, duration);

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [entry, finishDismiss, opacity, translateY]);

  if (!entry) {
    return null;
  }

  const { payload } = entry;
  const variant: ToastVariant = payload.variant ?? 'success';
  const accent = variant === 'warning' ? colors.indigo : colors.accent;

  return (
    <View style={styles.overlay} pointerEvents="box-none" testID="toast:host">
      <Animated.View
        style={[styles.wrap, { bottom: bottomOffset, borderLeftColor: accent }, animatedStyle]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <Text style={[typography.subtitle, styles.title]} testID="toast:title">
          {payload.title}
        </Text>
        {payload.message ? (
          <Text style={[typography.caption, styles.body]} testID="toast:message">
            {payload.message}
          </Text>
        ) : null}
        {payload.actionLabel ? (
          <Pressable
            onPress={() => payload.onActionPress?.()}
            style={styles.actionHit}
            accessibilityRole="button"
            accessibilityLabel={payload.actionLabel}
            testID="toast:action"
          >
            <Text style={[typography.caption, { color: accent }]}>{payload.actionLabel}</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
    justifyContent: 'flex-end',
  },
  wrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    maxWidth: 520,
    alignSelf: 'center',
    width: '100%',
    ...shadows.md,
  },
  title: {
    color: colors.text,
  },
  body: {
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  actionHit: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    minHeight: 44,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
  },
});
