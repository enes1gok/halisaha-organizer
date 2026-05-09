import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '../../../hooks/useReduceMotion';
import { colors, letterSpacing, radius, shadows, spacing, typography } from '../../../theme';
import { Durations, Springs } from '../../../utils/animations';
import { lightImpact } from '../../../utils/haptics';
import {
  buildMonthMatrix,
  describeDayForA11y,
  formatMonthTitle,
  type MonthDayCell,
} from '../adapters/groupMatchesByDay';

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;
const MAX_DOTS = 3;

type Direction = 'forward' | 'backward' | 'none';

type Props = {
  monthAnchor: Date;
  selectedDateKey: string | null;
  today: Date;
  dotsByDay: Map<string, number>;
  onChangeMonth: (delta: number) => void;
  onSelectDay: (key: string) => void;
  onResetToToday: () => void;
};

function MyMatchesCalendarBase({
  monthAnchor,
  selectedDateKey,
  today,
  dotsByDay,
  onChangeMonth,
  onSelectDay,
  onResetToToday,
}: Props) {
  const reduceMotion = useReduceMotion();
  const matrix = useMemo(() => buildMonthMatrix(monthAnchor, today), [monthAnchor, today]);

  const opacity = useSharedValue(1);
  const translateX = useSharedValue(0);
  const lastAnchorRef = useRef<number>(monthAnchor.getTime());

  useEffect(() => {
    const prev = lastAnchorRef.current;
    const curr = monthAnchor.getTime();
    if (prev === curr) return;
    lastAnchorRef.current = curr;
    const direction: Direction = curr > prev ? 'forward' : 'backward';

    cancelAnimation(opacity);
    cancelAnimation(translateX);

    if (reduceMotion) {
      opacity.value = 0.4;
      opacity.value = withTiming(1, { duration: Durations.fast });
      translateX.value = 0;
      return;
    }

    const offset = direction === 'forward' ? 14 : -14;
    opacity.value = 0.6;
    translateX.value = -offset;
    opacity.value = withTiming(1, {
      duration: Durations.normal,
      easing: Easing.out(Easing.cubic),
    });
    translateX.value = withTiming(0, {
      duration: Durations.normal,
      easing: Easing.out(Easing.cubic),
    });
  }, [monthAnchor, reduceMotion, opacity, translateX]);

  const animatedGridStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  const handlePrev = useCallback(() => {
    void lightImpact();
    onChangeMonth(-1);
  }, [onChangeMonth]);

  const handleNext = useCallback(() => {
    void lightImpact();
    onChangeMonth(1);
  }, [onChangeMonth]);

  const handleResetToToday = useCallback(() => {
    void lightImpact();
    onResetToToday();
  }, [onResetToToday]);

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Önceki ay"
          testID="myMatches:calendar:prev"
          onPress={handlePrev}
          hitSlop={10}
          style={({ pressed }) => [styles.chev, pressed && styles.chevPressed]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bugüne dön"
          testID="myMatches:calendar:title"
          onPress={handleResetToToday}
          hitSlop={6}
          style={({ pressed }) => [styles.titleWrap, pressed && styles.titlePressed]}
        >
          <Text style={styles.title}>{formatMonthTitle(monthAnchor)}</Text>
          <Text style={styles.titleHint}>Bugüne dön</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sonraki ay"
          testID="myMatches:calendar:next"
          onPress={handleNext}
          hitSlop={10}
          style={({ pressed }) => [styles.chev, pressed && styles.chevPressed]}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((label) => (
          <View key={label} style={styles.weekdayCell}>
            <Text style={styles.weekdayLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <Animated.View style={animatedGridStyle}>
        {matrix.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.gridRow}>
            {row.map((cell) => (
              <DayCell
                key={cell.dateKey}
                cell={cell}
                count={dotsByDay.get(cell.dateKey) ?? 0}
                selected={cell.dateKey === selectedDateKey}
                onSelect={onSelectDay}
                reduceMotion={reduceMotion}
              />
            ))}
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

export const MyMatchesCalendar = React.memo(MyMatchesCalendarBase);

type DayCellProps = {
  cell: MonthDayCell;
  count: number;
  selected: boolean;
  onSelect: (key: string) => void;
  reduceMotion: boolean;
};

function DayCell({ cell, count, selected, onSelect, reduceMotion }: DayCellProps) {
  const ringScale = useSharedValue(selected ? 1 : 0.6);
  const ringOpacity = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    cancelAnimation(ringScale);
    cancelAnimation(ringOpacity);
    if (selected) {
      if (reduceMotion) {
        ringScale.value = 1;
        ringOpacity.value = 1;
      } else {
        ringScale.value = withSpring(1, Springs.interactive);
        ringOpacity.value = withTiming(1, { duration: Durations.fast });
      }
    } else {
      ringScale.value = reduceMotion ? 0.6 : withTiming(0.6, { duration: Durations.fast });
      ringOpacity.value = reduceMotion ? 0 : withTiming(0, { duration: Durations.fast });
    }
  }, [selected, reduceMotion, ringScale, ringOpacity]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  const handlePress = useCallback(() => {
    void lightImpact();
    onSelect(cell.dateKey);
  }, [cell.dateKey, onSelect]);

  const dotsToShow = Math.min(count, MAX_DOTS);
  const numberColor = !cell.isCurrentMonth
    ? colors.textMuted
    : selected
      ? colors.accent
      : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={describeDayForA11y(cell.dateKey, count)}
      testID={`myMatches:calendar:day:${cell.dateKey}`}
      onPress={handlePress}
      style={styles.dayCell}
    >
      <View style={styles.dayInner}>
        <Animated.View style={[styles.selectedRing, ringStyle]} pointerEvents="none" />
        {cell.isToday && !selected ? <View style={styles.todayRing} pointerEvents="none" /> : null}
        <Text
          style={[
            styles.dayNumber,
            { color: numberColor },
            cell.isToday && !selected ? styles.dayNumberToday : null,
            !cell.isCurrentMonth && styles.dayNumberOutside,
          ]}
        >
          {cell.date.getDate()}
        </Text>
        <View style={styles.dotsRow}>
          {Array.from({ length: dotsToShow }, (_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                {
                  backgroundColor: !cell.isCurrentMonth
                    ? colors.textMuted
                    : selected
                      ? colors.accent
                      : colors.accent,
                },
              ]}
            />
          ))}
          {count > MAX_DOTS ? (
            <Text style={styles.dotOverflow}>+{count - MAX_DOTS}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const CELL_PADDING_V = 6;
const CELL_MIN_HEIGHT = 56;
const RING_SIZE = 36;

const styles = StyleSheet.create({
  shell: {
    backgroundColor: colors.surfaceGlass,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
  },
  chev: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  chevPressed: {
    backgroundColor: colors.glassHighlight,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
  },
  titlePressed: {
    backgroundColor: colors.glassHighlight,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
    letterSpacing: letterSpacing.tight,
  },
  titleHint: {
    ...typography.micro,
    color: colors.textMuted,
    letterSpacing: letterSpacing.normal,
    marginTop: 2,
  },
  weekdayRow: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayLabel: {
    ...typography.micro,
    color: colors.textMuted,
    letterSpacing: letterSpacing.wide,
    textTransform: 'uppercase',
  },
  gridRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    minHeight: CELL_MIN_HEIGHT,
    paddingVertical: CELL_PADDING_V,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInner: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    position: 'relative',
  },
  selectedRing: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    backgroundColor: colors.accentMuted,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  todayRing: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  dayNumber: {
    ...typography.body,
    color: colors.text,
  },
  dayNumberToday: {
    fontFamily: typography.subtitle.fontFamily,
    fontWeight: typography.subtitle.fontWeight,
  },
  dayNumberOutside: {
    opacity: 0.45,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginTop: 4,
    minHeight: 6,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dotOverflow: {
    ...typography.micro,
    color: colors.accent,
    marginLeft: 2,
  },
});
