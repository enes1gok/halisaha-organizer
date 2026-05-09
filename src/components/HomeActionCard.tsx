import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SurfaceGradient } from './SurfaceGradient';
import { colors, letterSpacing, radius, spacing, typography } from '../theme';

/** Text/icons on green accent for contrast (matches legacy FAB). */
const ON_ACCENT = '#0A0A0A';
const ON_ACCENT_MUTED = 'rgba(10,10,10,0.72)';

type Props = {
  onJoinPress: () => void;
  onCreatePress: () => void;
};

export function HomeActionCard({ onJoinPress, onCreatePress }: Props) {
  return (
    <SurfaceGradient style={styles.row}>
      <View style={styles.rowInner}>
        <Pressable
          onPress={onJoinPress}
          style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
          android_ripple={{ color: 'rgba(10,10,10,0.12)' }}
        >
          <Ionicons name="enter-outline" size={22} color={ON_ACCENT} />
          <Text style={styles.cellTitle}>Maça katıl</Text>
          <Text style={styles.cellHint}>Kod ile katıl</Text>
        </Pressable>
        <View style={styles.divider} />
        <Pressable
          onPress={onCreatePress}
          style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
          android_ripple={{ color: 'rgba(10,10,10,0.12)' }}
        >
          <Ionicons name="add-circle-outline" size={22} color={ON_ACCENT} />
          <Text style={styles.cellTitle}>Maçı kur</Text>
          <Text style={styles.cellHint}>Yeni maç oluştur</Text>
        </Pressable>
      </View>
    </SurfaceGradient>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.accentMuted,
    borderRadius: radius.card,
    minHeight: 72,
  },
  rowInner: {
    flexDirection: 'row',
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.accent,
  },
  cell: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  cellPressed: {
    opacity: 0.9,
  },
  cellTitle: {
    ...typography.subtitle,
    color: ON_ACCENT,
    fontSize: 15,
    letterSpacing: letterSpacing.normal,
  },
  cellHint: {
    ...typography.micro,
    color: ON_ACCENT_MUTED,
    textAlign: 'center',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(10,10,10,0.2)',
    marginVertical: spacing.sm,
  },
});
