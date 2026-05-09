import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import { PositionBadge } from '../../components/PositionBadge';
import { colors, letterSpacing, spacing, typography } from '../../theme';
import type { Player } from '../../types/domain';

export function ProfileIdentityHeader({ player }: { player: Player }) {
  return (
    <View style={styles.hero} accessibilityLabel={`${player.name}, ${player.position}`}>
      <PlayerAvatar name={player.name} uri={player.photoUri} size={88} />
      <Text style={styles.heroName}>{player.name}</Text>
      <View style={styles.badges}>
        <PositionBadge position={player.position} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surfaceGlass,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroName: {
    ...typography.headlineStrong,
    color: colors.text,
    marginTop: spacing.sm,
    letterSpacing: letterSpacing.wide,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
});
