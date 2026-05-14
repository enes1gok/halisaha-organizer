import React, { useCallback } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import { colors, letterSpacing, radius, shadows, spacing, typography } from '../../../theme';
import { selectionTick } from '../../../utils/haptics';
import type { MatchDetailTab } from '../types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const OPTIONS: ReadonlyArray<{ value: MatchDetailTab; label: string; testId: string }> = [
  { value: 'summary', label: 'Özet', testId: 'match:detail:tab:summary' },
  { value: 'roster', label: 'Kadro', testId: 'match:detail:tab:roster' },
];

type Props = {
  value: MatchDetailTab;
  onChange: (next: MatchDetailTab) => void;
};

export function MatchDetailSegmentControl({ value, onChange }: Props) {
  const handlePress = useCallback(
    (next: MatchDetailTab) => {
      if (next === value) return;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      void selectionTick();
      onChange(next);
    },
    [onChange, value],
  );

  return (
    <View style={styles.shell} accessibilityRole="tablist">
      {OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => handlePress(option.value)}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
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
              style={[styles.label, active ? styles.labelActive : styles.labelInactive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceGlass,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
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
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  cellPressed: {
    backgroundColor: colors.glassHighlight,
  },
  label: {
    ...typography.caption,
    letterSpacing: letterSpacing.normal,
  },
  labelActive: {
    color: colors.accent,
    fontFamily: typography.subtitle.fontFamily,
    fontWeight: typography.subtitle.fontWeight,
  },
  labelInactive: {
    color: colors.textMuted,
  },
});
