import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { SurfaceGradient } from './SurfaceGradient';
import { colors, letterSpacing, radius, spacing, typography } from '../theme';

/** Text/icons on green accent — same canvas as app bg for contrast on accent bar */
const ON_ACCENT = colors.background;
const ON_ACCENT_MUTED = 'rgba(10,10,10,0.72)';

type Props = {
  onJoinPress: () => void;
  onCreatePress: () => void;
};

export function HomeActionCard({ onJoinPress, onCreatePress }: Props) {
  return (
    <SurfaceGradient style={styles.row}>
      <View style={styles.rowInner}>
        <PressableScale
          onPress={onJoinPress}
          style={styles.cell}
          android_ripple={{ color: 'rgba(10,10,10,0.12)' }}
        >
          <Ionicons name="enter-outline" size={22} color={ON_ACCENT} />
          <Text style={styles.cellTitle}>Maça katıl</Text>
          <Text style={styles.cellHint}>Kod ile katıl</Text>
        </PressableScale>
        <View style={styles.divider} />
        <PressableScale
          onPress={onCreatePress}
          style={styles.cell}
          android_ripple={{ color: 'rgba(10,10,10,0.12)' }}
        >
          <Ionicons name="add-circle-outline" size={22} color={ON_ACCENT} />
          <Text style={styles.cellTitle}>Maçı kur</Text>
          <Text style={styles.cellHint}>Yeni maç oluştur</Text>
        </PressableScale>
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
