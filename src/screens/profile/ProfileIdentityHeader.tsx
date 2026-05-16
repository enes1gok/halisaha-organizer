import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BadgeTileVm } from '../../domain/badges';
import { PillButton } from '../../components/PillButton';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import { radius, spacing, typography } from '../../theme';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import type { Player, Position, PreferredFoot } from '../../types/domain';
import { ProfileBadgesModal } from './ProfileBadgesModal';

type Props = {
  player: Player;
  badgeTiles?: BadgeTileVm[];
  showEditControls?: boolean;
  emailVerified?: boolean;
  onEditPress?: () => void;
};

function positionLabel(pos: Position): string {
  const map: Record<Position, string> = {
    GK: 'Kaleci',
    DEF: 'Defans',
    MID: 'Orta Saha',
    FWD: 'Forvet',
  };
  return map[pos];
}

function footLabel(foot: PreferredFoot): string {
  if (foot === 'left') return 'Sol';
  if (foot === 'right') return 'Sağ';
  return 'İki Ayak';
}

export function ProfileIdentityHeader({ player, badgeTiles, showEditControls, emailVerified, onEditPress }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [sheetOpen, setSheetOpen] = useState(false);

  const earned = useMemo(
    () => (badgeTiles ?? []).filter((b) => b.earned),
    [badgeTiles],
  );

  const rating = player.stats.ratingAverage100;

  return (
    <View style={styles.hero} accessibilityLabel={`${player.name}, ${player.position}`}>
      {/* Zone 1: Avatar + kimlik + rating */}
      <View style={styles.identityZone}>
        {/* Avatar + Edit Button (stacked) */}
        <View style={styles.avatarCol}>
          <View style={[styles.avatarRing, { borderColor: colors.accent }]}>
            <PlayerAvatar name={player.name} uri={player.photoUri} size={80} />
          </View>
          {showEditControls ? (
            <PillButton
              title="Düzenle"
              variant="ghost"
              onPress={onEditPress}
              style={styles.editBtn}
              testID="profile:edit:press"
            />
          ) : null}
        </View>

        <View style={styles.nameCol}>
          <Text style={styles.heroName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
            {player.name}
          </Text>
          {showEditControls && emailVerified !== undefined && (
            <Text
              style={emailVerified ? styles.emailOk : styles.emailWarn}
              testID="profile:identity:email-verification"
            >
              {emailVerified ? '✓ Doğrulandı' : '✗ Doğrulanmadı'}
            </Text>
          )}
        </View>

        <View style={styles.ratingCol} accessibilityLabel={`Ortalama puan: ${rating != null ? rating.toFixed(1) : 'yok'}`}>
          <Text style={rating != null ? styles.ratingVal : styles.ratingEmpty}>
            {rating != null ? rating.toFixed(1) : '—'}
          </Text>
          <Text style={styles.ratingLbl}>Ort. Puan</Text>
        </View>
      </View>

      {/* Zone 2: Özellik şeridi */}
      <View style={styles.attributeStrip}>
        <View style={styles.attributeCell}>
          <View style={styles.attributeRow}>
            <View style={[styles.posDot, { backgroundColor: colors.position[player.position] }]} />
            <Text style={styles.attributeVal} numberOfLines={1}>{positionLabel(player.position)}</Text>
          </View>
          <Text style={styles.attributeLbl}>Pozisyon</Text>
        </View>
        <View style={styles.attributeDivider} />
        <View style={styles.attributeCell}>
          <Text style={styles.attributeVal}>{footLabel(player.preferredFoot)}</Text>
          <Text style={styles.attributeLbl}>Tercih</Text>
        </View>
      </View>

      {/* Zone 3: Rozetler */}
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
      backgroundColor: t.colors.surfaceGlass,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.glassBorder,
    },
    identityZone: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    avatarCol: {
      alignItems: 'center',
      gap: spacing.xs,
    },
    avatarRing: {
      borderRadius: 999,
      borderWidth: 3,
      padding: 3,
      shadowColor: t.colors.accent,
      shadowOpacity: 0.3,
      shadowOffset: { width: 0, height: 0 },
      shadowRadius: 10,
    },
    nameCol: {
      flex: 1,
      gap: 4,
    },
    heroName: {
      fontSize: 22,
      fontFamily: 'Inter_700Bold',
      color: t.colors.text,
      lineHeight: 28,
    },
    emailOk: {
      ...typography.caption,
      color: t.colors.accent,
    },
    emailWarn: {
      ...typography.caption,
      color: t.colors.danger,
    },
    editBtn: {
      minHeight: 36,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    ratingCol: {
      width: 88,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ratingVal: {
      fontSize: 36,
      fontFamily: 'Inter_900Black',
      color: t.colors.accent,
      lineHeight: 42,
    },
    ratingEmpty: {
      fontSize: 28,
      fontFamily: 'Inter_900Black',
      color: t.colors.textMuted,
      lineHeight: 34,
    },
    ratingLbl: {
      ...typography.micro,
      color: t.colors.textMuted,
      textAlign: 'center',
    },
    attributeStrip: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: t.colors.glassBorder,
    },
    attributeCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      gap: 2,
    },
    attributeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    posDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    attributeVal: {
      ...typography.body,
      fontFamily: 'Inter_600SemiBold',
      color: t.colors.text,
    },
    attributeLbl: {
      ...typography.micro,
      color: t.colors.textMuted,
    },
    attributeDivider: {
      width: 1,
      backgroundColor: t.colors.glassBorder,
      marginVertical: spacing.xs,
    },
    badgeScroll: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
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
