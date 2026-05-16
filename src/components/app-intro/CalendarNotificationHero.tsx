import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { radius, shadows, spacing } from '../../theme';
import { makeStyles, useTheme } from '../../theme/ThemeContext';

type Props = {
  reduceMotion: boolean;
};

const ROWS = 4;
const COLS = 7;

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    wrap: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 220,
      paddingVertical: spacing.md,
    },
    calendarCard: {
      width: '88%',
      maxWidth: 320,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: spacing.md,
      overflow: 'hidden',
    },
    calendarHeader: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    headerDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.colors.accent,
    },
    headerDotMuted: {
      backgroundColor: t.colors.border,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      justifyContent: 'center',
    },
    cell: {
      width: 28,
      height: 14,
      borderRadius: 4,
      backgroundColor: t.colors.border,
      opacity: 0.45,
    },
    cellAccent: {
      backgroundColor: t.colors.accent,
      opacity: 0.85,
    },
    bellWrap: {
      position: 'absolute',
      right: '8%',
      bottom: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bellGlow: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 48,
      opacity: 0.5,
    },
    badge: {
      position: 'absolute',
      top: -2,
      right: -2,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: t.colors.danger,
      borderWidth: 2,
      borderColor: t.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeInner: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: t.colors.text,
    },
  }),
);

export function CalendarNotificationHero({ reduceMotion }: Props) {
  const styles = useStyles();
  const { colors: themeColors } = useTheme();
  const bellScale = useSharedValue(1);
  const badgePulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      bellScale.value = 1;
      badgePulse.value = 1;
      return;
    }
    bellScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    badgePulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [reduceMotion, bellScale, badgePulse]);

  const bellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bellScale.value }],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 1 : 0.35 + badgePulse.value * 0.65,
    transform: [{ scale: reduceMotion ? 1 : 0.85 + badgePulse.value * 0.15 }],
  }));

  return (
    <View style={styles.wrap} accessibilityRole="image" accessibilityLabel="Takvim ve bildirim önizlemesi">
      <LinearGradient
        colors={[themeColors.surfaceSoft, themeColors.surface]}
        style={[styles.calendarCard, shadows.md]}
      >
        <View style={styles.calendarHeader}>
          <View style={styles.headerDot} />
          <View style={[styles.headerDot, styles.headerDotMuted]} />
          <View style={[styles.headerDot, styles.headerDotMuted]} />
        </View>
        <View style={styles.grid}>
          {Array.from({ length: ROWS * COLS }).map((_, i) => (
            <View
              key={i}
              style={[styles.cell, i === 10 ? styles.cellAccent : undefined]}
            />
          ))}
        </View>
      </LinearGradient>

      <Animated.View style={[styles.bellWrap, bellStyle]}>
        <LinearGradient colors={[themeColors.accentMuted, 'transparent']} style={styles.bellGlow} />
        <Ionicons name="notifications" size={44} color={themeColors.accent} accessibilityElementsHidden />
        <Animated.View style={[styles.badge, badgeStyle]}>
          <View style={styles.badgeInner} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}
