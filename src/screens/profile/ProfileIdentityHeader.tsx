import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BadgeTileVm } from '../../domain/badges';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import { PositionBadge } from '../../components/PositionBadge';
import { letterSpacing, radius, spacing, typography } from '../../theme';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import type { Player } from '../../types/domain';
import { ProfileBadgesModal } from './ProfileBadgesModal';

type Props = {
  player: Player;
  badgeTiles?: BadgeTileVm[];
};

export function ProfileIdentityHeader({ player, badgeTiles }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [sheetOpen, setSheetOpen] = useState(false);

  const earned = useMemo(
    () => (badgeTiles ?? []).filter((b) => b.earned),
    [badgeTiles],
  );

  return (
    <View style={styles.hero} accessibilityLabel={`${player.name}, ${player.position}`}>
      <PlayerAvatar name={player.name} uri={player.photoUri} size={88} />
      <Text style={styles.heroName}>{player.name}</Text>
      <View style={styles.badges}>
        <PositionBadge position={player.position} />
      </View>
      {badgeTiles && badgeTiles.length > 0 ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.badgeScroll}
          >
            {earned.slice(0, 8).map((b) => (
              <View
                key={b.id}
                style={[styles.badgeChip, { borderColor: colors.accent, backgroundColor: colors.accentMuted }]}
              >
                <Text style={[styles.badgeChipText, { color: colors.text }]} numberOfLines={1}>
                  {b.title}
                </Text>
              </View>
            ))}
            <Pressable
              onPress={() => setSheetOpen(true)}
              style={[styles.allBtn, { borderColor: colors.border }]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Tüm rozetleri göster"
              testID="profile:badges:open_all"
            >
              <Text style={[styles.allBtnTxt, { color: colors.accent }]}>Tümü</Text>
            </Pressable>
          </ScrollView>
          <ProfileBadgesModal visible={sheetOpen} onClose={() => setSheetOpen(false)} badges={badgeTiles} />
        </>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    hero: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      backgroundColor: t.colors.surfaceGlass,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.glassBorder,
      alignItems: 'center',
      gap: spacing.sm,
    },
    heroName: {
      ...typography.headlineStrong,
      color: t.colors.text,
      marginTop: spacing.sm,
      letterSpacing: letterSpacing.wide,
    },
    badges: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    badgeScroll: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      maxWidth: '100%',
    },
    badgeChip: {
      maxWidth: 140,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    badgeChipText: {
      ...typography.micro,
    },
    allBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
      borderWidth: 1,
      minHeight: 44,
      justifyContent: 'center',
    },
    allBtnTxt: {
      ...typography.micro,
      fontWeight: '600',
    },
  }),
);
