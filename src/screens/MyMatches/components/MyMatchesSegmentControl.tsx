import React, { useCallback } from 'react';
import { Platform, Pressable, StyleSheet, Text, UIManager, View, LayoutAnimation } from 'react-native';
import { letterSpacing, radius, shadows, spacing, typography } from '../../../theme';
import { makeStyles } from '../../../theme/ThemeContext';
import { selectionTick } from '../../../utils/haptics';
import type { SegmentCounts, SegmentValue } from '../adapters/groupMatchesByDay';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const BASE_OPTIONS: ReadonlyArray<{
  value: SegmentValue;
  label: string;
  testId: string;
  countKey: keyof SegmentCounts;
}> = [
  { value: 'upcoming', label: 'Yaklaşan', testId: 'myMatches:segment:upcoming', countKey: 'upcoming' },
  { value: 'past', label: 'Geçmiş', testId: 'myMatches:segment:past', countKey: 'past' },
  { value: 'all', label: 'Tümü', testId: 'myMatches:segment:all', countKey: 'all' },
];

const DEFAULT_COUNTS: SegmentCounts = { upcoming: 0, past: 0, all: 0 };

type Props = {
  value: SegmentValue;
  onChange: (next: SegmentValue) => void;
  counts?: SegmentCounts;
};

export function MyMatchesSegmentControl({ value, onChange, counts = DEFAULT_COUNTS }: Props) {
  const styles = useStyles();
  const handlePress = useCallback(
    (next: SegmentValue) => {
      if (next === value) return;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      void selectionTick();
      onChange(next);
    },
    [onChange, value],
  );

  return (
    <View style={styles.shell} accessibilityRole="tablist">
      {BASE_OPTIONS.map((option) => {
        const active = option.value === value;
        const n = counts[option.countKey];
        const accessibilityLabel =
          n === 1 ? `${option.label}, 1 maç` : `${option.label}, ${n} maç`;
        const shortLabel = `${option.label} (${n})`;
        return (
          <Pressable
            key={option.value}
            onPress={() => handlePress(option.value)}
            accessibilityRole="tab"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ selected: active }}
            testID={option.testId}
            hitSlop={4}
            style={({ pressed }) => [
              styles.cell,
              active && styles.cellActive,
              pressed && !active && styles.cellPressed,
            ]}
          >
            <Text
              style={[
                styles.label,
                active ? styles.labelActive : styles.labelInactive,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {shortLabel}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    shell: {
      flexDirection: 'row',
      backgroundColor: t.colors.surfaceGlass,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: t.colors.glassBorder,
      padding: 4,
      gap: 4,
      ...shadows.sm,
    },
    cell: {
      flex: 1,
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cellActive: {
      backgroundColor: t.colors.accentMuted,
      borderWidth: 1,
      borderColor: t.colors.accent,
    },
    cellPressed: {
      backgroundColor: t.colors.glassHighlight,
    },
    label: {
      ...typography.caption,
      letterSpacing: letterSpacing.normal,
    },
    labelActive: {
      color: t.colors.accent,
      fontFamily: typography.subtitle.fontFamily,
      fontWeight: typography.subtitle.fontWeight,
    },
    labelInactive: {
      color: t.colors.textMuted,
    },
  }),
);
