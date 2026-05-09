import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, gradients, radius } from '../theme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function SurfaceGradient({ children, style }: Props) {
  return (
    <LinearGradient
      colors={gradients.surface}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.base, style]}
    >
      <View style={styles.overlay}>{children}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.surfaceGlass,
    overflow: 'hidden',
  },
  overlay: {
    borderRadius: radius.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.glassHighlight,
  },
});
