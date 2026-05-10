import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { radius, spacing, typography } from '../theme';
import { makeStyles, useThemeColors } from '../theme/ThemeContext';

type Props = {
  label: string;
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  baseColor: string;
  textColorOnFill: string;
  isSelected: boolean;
  onPress: () => Promise<void> | void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
};

export function RsvpOptionButton({
  label,
  iconName,
  baseColor,
  textColorOnFill,
  isSelected,
  onPress,
  disabled,
  testID,
  accessibilityLabel,
}: Props) {
  const styles = useStyles();
  const colors = useThemeColors();
  const [committing, setCommitting] = useState(false);

  const handlePress = async () => {
    if (committing || disabled) return;
    setCommitting(true);
    try {
      await onPress();
    } finally {
      setCommitting(false);
    }
  };

  const backgroundColor = isSelected ? baseColor : 'transparent';
  const borderColor = isSelected ? baseColor : colors.border;
  const contentColor = isSelected ? textColorOnFill : baseColor;

  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={committing || disabled}
      onPress={() => void handlePress()}
      pressedScale={0.98}
      style={[
        styles.container,
        { backgroundColor, borderColor }
      ]}
    >
      <View style={styles.content}>
        {committing ? (
          <ActivityIndicator color={contentColor} size="small" style={styles.iconPlaceholder} />
        ) : (
          <Ionicons name={iconName} size={22} color={contentColor} />
        )}
        <Text style={[styles.label, { color: contentColor }]}>{label}</Text>
      </View>
    </PressableScale>
  );
}

const useStyles = makeStyles(() =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 48,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    iconPlaceholder: {
      width: 22,
      height: 22,
    },
    label: {
      ...typography.subtitle,
      fontSize: 15,
      flex: 1,
    },
  })
);
