import React, { useEffect } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/ThemeContext';

interface AppLoadingScreenProps {
  message: string;
  subtitle?: string;
}

export function AppLoadingScreen({ message, subtitle }: AppLoadingScreenProps) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (!reduceMotion) {
      opacity.value = withTiming(1, { duration: 300 });
    }
  }, [opacity, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
    },
    brandBlock: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    icon: {
      width: 72,
      height: 72,
      borderRadius: 16,
      marginBottom: spacing.md,
    },
    appName: {
      ...typography.title,
      color: colors.text,
      letterSpacing: 0.5,
    },
    appTagline: {
      ...typography.caption,
      color: colors.textMuted,
      marginTop: spacing.xs,
    },
    divider: {
      width: 48,
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.lg,
    },
    spinnerBlock: {
      alignItems: 'center',
      gap: spacing.sm,
    },
    message: {
      ...typography.body,
      color: colors.textMuted,
      textAlign: 'center',
    },
    subtitleText: {
      ...typography.caption,
      color: colors.textMuted,
      textAlign: 'center',
      opacity: 0.7,
    },
  });

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={styles.brandBlock}>
        <Image
          source={require('../../assets/splash-icon.png')}
          style={styles.icon}
          resizeMode="contain"
        />
        <Text style={styles.appName}>Halısaha</Text>
        <Text style={styles.appTagline}>Maç Organize Et</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.spinnerBlock}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.message}>{message}</Text>
        {subtitle ? <Text style={styles.subtitleText}>{subtitle}</Text> : null}
      </View>
    </Animated.View>
  );
}
