import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { radius } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function SurfaceGradient({ children, style }: Props) {
  const { gradients } = useTheme();
  const styles = useStyles();

  return (
    <LinearGradient
      colors={[...gradients.surface]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.base, style]}
    >
      <View style={styles.overlay}>{children}</View>
    </LinearGradient>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    base: {
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: t.colors.glassBorder,
      backgroundColor: t.colors.surfaceGlass,
      overflow: 'hidden',
    },
    overlay: {
      borderRadius: radius.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.glassHighlight,
    },
  }),
);
