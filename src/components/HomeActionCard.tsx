import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { SurfaceGradient } from './SurfaceGradient';
import { letterSpacing, radius, spacing, typography } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';

type Props = {
  onJoinPress: () => void;
  onCreatePress: () => void;
};

export function HomeActionCard({ onJoinPress, onCreatePress }: Props) {
  const styles = useStyles();
  const { scheme, colors } = useTheme();
  const ripple =
    scheme === 'dark' ? 'rgba(10,10,10,0.12)' : 'rgba(255,255,255,0.18)';

  return (
    <SurfaceGradient style={styles.row}>
      <View style={styles.rowInner}>
        <PressableScale
          onPress={onJoinPress}
          style={styles.cell}
          android_ripple={{ color: ripple }}
        >
          <Ionicons name="enter-outline" size={22} color={colors.textOnAccent} />
          <Text style={styles.cellTitle}>Maça katıl</Text>
          <Text style={styles.cellHint}>Kod ile katıl</Text>
        </PressableScale>
        <View style={styles.divider} />
        <PressableScale
          onPress={onCreatePress}
          style={styles.cell}
          android_ripple={{ color: ripple }}
        >
          <Ionicons name="add-circle-outline" size={22} color={colors.textOnAccent} />
          <Text style={styles.cellTitle}>Maçı kur</Text>
          <Text style={styles.cellHint}>Yeni maç oluştur</Text>
        </PressableScale>
      </View>
    </SurfaceGradient>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    row: {
      backgroundColor: t.colors.accentMuted,
      borderRadius: radius.card,
      minHeight: 72,
    },
    rowInner: {
      flexDirection: 'row',
      borderRadius: radius.card,
      overflow: 'hidden',
      backgroundColor: t.colors.accent,
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
      color: t.colors.textOnAccent,
      fontSize: 15,
      letterSpacing: letterSpacing.normal,
    },
    cellHint: {
      ...typography.micro,
      color: t.colors.textOnAccentMuted,
      textAlign: 'center',
    },
    divider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor:
        t.scheme === 'dark' ? 'rgba(10,10,10,0.2)' : 'rgba(255,255,255,0.22)',
      marginVertical: spacing.sm,
    },
  }),
);
