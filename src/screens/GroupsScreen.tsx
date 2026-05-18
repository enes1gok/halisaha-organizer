import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { EmptyStateHero } from '../components/emptyIllustrations';
import { GroupsActionCard } from '../components/GroupsActionCard';
import { PillButton } from '../components/PillButton';
import { GroupCardSkeleton, SkeletonList } from '../components/skeleton';
import type { GroupsStackParamList } from '../navigation/types';
import {
  HOME_ACTION_STRIP_GAP,
  HOME_ACTION_STRIP_HEIGHT,
  TAB_BAR_FLOAT_MARGIN_BOTTOM,
  TAB_BAR_FLOATING_BLOCK_HEIGHT,
} from '../navigation/tabBarLayout';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { useAuthStore, useGroupsStore, useMatchesStore } from '../store';
import { groupAvatarColors, groupAvatarTextColor, radius, shadows, spacing, typography } from '../theme';
import { makeStyles, useThemeColors } from '../theme/ThemeContext';
import type { Group } from '../types/domain';
import { formatShortDate } from '../utils/dates';

type Nav = NativeStackNavigationProp<GroupsStackParamList, 'GroupsMain'>;

const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function getGroupAvatarColor(groupId: string): string {
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) {
    hash = (hash * 31 + groupId.charCodeAt(i)) & 0xffffff;
  }
  // groupAvatarColors readonly tuple > 0 elemanlı — non-null assertion güvenli.
  return groupAvatarColors[hash % groupAvatarColors.length]!;
}

function getGroupInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const first = words[0]![0] ?? '';
    const second = words[1]![0] ?? '';
    return (first + second).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

interface GroupListMeta {
  upcomingCount: number;
  lastFinishedAt: string | null;
  activeMemberCount: number;
  totalMemberCount: number;
}

type GroupsListRowProps = {
  group: Group;
  meta: GroupListMeta;
  onPress: () => void;
  accessibilityLabel: string;
};

function GroupsListRow({ group, meta, onPress, accessibilityLabel }: GroupsListRowProps) {
  const styles = useGroupsStyles();
  const c = useThemeColors();
  const lastFinishedLabel = meta.lastFinishedAt ? formatShortDate(meta.lastFinishedAt) : null;
  const avatarColor = getGroupAvatarColor(group.id);
  const initials = getGroupInitials(group.name);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      testID={`groups:group:${group.id}:open`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Grup detayını aç"
    >
      <View style={[styles.avatarSection, { backgroundColor: group.photoUri ? undefined : avatarColor }]}>
        {group.photoUri ? (
          <Image
            source={{ uri: group.photoUri }}
            style={styles.avatarImage}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.avatarText}>{initials}</Text>
        )}
      </View>

      <View style={styles.contentSection}>
        <View style={styles.headerRow}>
          <Text style={styles.name} numberOfLines={1}>
            {group.name}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
        </View>

        <View
          style={styles.metaChipsRow}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={styles.memberHint}>
            <Ionicons name="people-outline" size={12} color={c.textMuted} />
            <Text style={styles.memberCount}>{meta.totalMemberCount} üye</Text>
          </View>

          <View style={styles.metaChip}>
            <Ionicons name="calendar-outline" size={12} color={c.accent} />
            <Text style={styles.metaChipText} numberOfLines={1}>
              {meta.upcomingCount} yaklaşan
            </Text>
          </View>

          {lastFinishedLabel && (
            <View style={styles.metaChip}>
              <Ionicons name="flag-outline" size={12} color={c.textMuted} />
              <Text style={styles.metaChipText} numberOfLines={1}>
                Son: {lastFinishedLabel}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export function GroupsScreen() {
  const styles = useGroupsStyles();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.getCurrentUserId());
  const groups = useGroupsStore((s) => s.groups);
  const memberships = useGroupsStore((s) => s.groupMemberships);
  const matches = useMatchesStore((s) => s.matches);
  const { configured, loading } = useSupabaseAuth();
  const [skeletonExpired, setSkeletonExpired] = useState(false);

  useEffect(() => {
    const showInitialSkeleton = configured && loading && groups.length === 0 && memberships.length === 0;
    if (!showInitialSkeleton) return;
    const timer = setTimeout(() => setSkeletonExpired(true), 8_000);
    return () => clearTimeout(timer);
  }, [configured, loading, groups.length, memberships.length]);

  const myGroups = useMemo(
    () =>
      groups.filter((group) =>
        memberships.some(
          (membership) => membership.groupId === group.id && membership.playerId === userId,
        ),
      ),
    [groups, memberships, userId],
  );

  const groupMeta = useMemo(() => {
    const now = Date.now();
    const activeCutoff = now - ACTIVE_WINDOW_MS;

    const matchesByGroup = new Map<string, typeof matches>();
    for (const match of matches) {
      if (!match.groupId) continue;
      const arr = matchesByGroup.get(match.groupId);
      if (arr) arr.push(match);
      else matchesByGroup.set(match.groupId, [match]);
    }

    const membersByGroup = new Map<string, Set<string>>();
    for (const membership of memberships) {
      const set = membersByGroup.get(membership.groupId);
      if (set) set.add(membership.playerId);
      else membersByGroup.set(membership.groupId, new Set([membership.playerId]));
    }

    const result = new Map<string, GroupListMeta>();
    for (const group of myGroups) {
      const groupMatches = matchesByGroup.get(group.id) ?? [];
      const memberSet = membersByGroup.get(group.id) ?? new Set<string>();

      let upcomingCount = 0;
      let lastFinishedAt: string | null = null;
      let lastFinishedMs = -Infinity;
      const activeIds = new Set<string>();

      for (const match of groupMatches) {
        const startsAtMs = new Date(match.startsAt).getTime();
        if (Number.isNaN(startsAtMs)) continue;

        if (match.status === 'upcoming' && startsAtMs >= now) {
          upcomingCount += 1;
        }
        if (match.status === 'finished' && startsAtMs > lastFinishedMs) {
          lastFinishedMs = startsAtMs;
          lastFinishedAt = match.startsAt;
        }
        if (startsAtMs >= activeCutoff) {
          for (const att of match.attendees) {
            activeIds.add(att.playerId);
          }
        }
      }

      let activeMemberCount = 0;
      for (const id of activeIds) {
        if (memberSet.has(id)) activeMemberCount += 1;
      }

      result.set(group.id, {
        upcomingCount,
        lastFinishedAt,
        activeMemberCount,
        totalMemberCount: memberSet.size,
      });
    }

    return result;
  }, [matches, memberships, myGroups]);

  const adjustedListPaddingBottom =
    HOME_ACTION_STRIP_HEIGHT +
    HOME_ACTION_STRIP_GAP +
    TAB_BAR_FLOATING_BLOCK_HEIGHT +
    TAB_BAR_FLOAT_MARGIN_BOTTOM +
    Math.max(insets.bottom, 8) +
    16;

  const showInitialSkeleton = configured && loading && groups.length === 0 && memberships.length === 0 && !skeletonExpired;
  const showCenteredEmptyCTAs = !showInitialSkeleton && myGroups.length === 0;

  if (showCenteredEmptyCTAs) {
    return (
      <View style={styles.screen}>
        <View style={styles.centeredEmpty}>
          <EmptyStateHero variant="groups" testID="groups:empty:hero" />
          <Card style={styles.ctaBlockCard}>
            <PillButton
              title="Grup Oluştur"
              onPress={() => navigation.navigate('CreateGroup')}
              testID="groups:create:press"
              accessibilityLabel="Grup oluştur"
              style={styles.ctaButton}
            />
            <Text style={styles.ctaDescription} accessibilityRole="text">
              Arkadaşlarınla grup aç, birlikte maç organize et ve grubunun aktivitelerini buradan yönet.
            </Text>
          </Card>
          <Card style={styles.ctaBlockCard}>
            <PillButton
              title="Kod ile Katıl"
              variant="ghost"
              onPress={() => navigation.navigate('JoinGroup')}
              testID="groups:join:press"
              accessibilityLabel="Kod ile gruba katıl"
              style={styles.ctaButton}
            />
            <Text style={styles.ctaDescription} accessibilityRole="text">
              Sana iletilen davet kodunu girerek var olan bir gruba katıl ve o grubun maçlarına dahil ol.
            </Text>
          </Card>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={[styles.list, { paddingBottom: adjustedListPaddingBottom }]}
        data={showInitialSkeleton ? [] : myGroups}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          showInitialSkeleton ? (
            <SkeletonList count={4} renderItem={() => <GroupCardSkeleton />} />
          ) : null
        }
        renderItem={({ item }) => {
          const meta = groupMeta.get(item.id) ?? {
            upcomingCount: 0,
            lastFinishedAt: null,
            activeMemberCount: 0,
            totalMemberCount: 0,
          };
          const lastFinishedLabel = meta.lastFinishedAt
            ? formatShortDate(meta.lastFinishedAt)
            : null;
          const a11yLabel =
            `${item.name}, ${meta.upcomingCount} yaklaşan maç, ` +
            `${
              lastFinishedLabel
                ? `son maç ${lastFinishedLabel}`
                : 'henüz oynanmış maç yok'
            }, son 30 günde ${meta.activeMemberCount} aktif üye, ` +
            `toplam ${meta.totalMemberCount} üye, gruba aç`;

          return (
            <GroupsListRow
              group={item}
              meta={meta}
              onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
              accessibilityLabel={a11yLabel}
            />
          );
        }}
      />

      <View
        style={[
          styles.actionStrip,
          {
            bottom:
              TAB_BAR_FLOATING_BLOCK_HEIGHT +
              TAB_BAR_FLOAT_MARGIN_BOTTOM +
              Math.max(insets.bottom, 8),
          },
        ]}
        pointerEvents="box-none"
      >
        <GroupsActionCard
          onJoinPress={() => navigation.navigate('JoinGroup')}
          onCreatePress={() => navigation.navigate('CreateGroup')}
        />
      </View>
    </View>
  );
}

const useGroupsStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.background },
    centeredEmpty: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      paddingBottom: TAB_BAR_FLOATING_BLOCK_HEIGHT + TAB_BAR_FLOAT_MARGIN_BOTTOM,
      gap: spacing.md,
      width: '100%',
    },
    ctaBlockCard: {
      alignSelf: 'stretch',
      width: '100%',
      gap: spacing.sm,
    },
    ctaDescription: {
      ...typography.caption,
      color: t.colors.textMuted,
      textAlign: 'left',
    },
    ctaButton: {
      alignSelf: 'stretch',
      width: '100%',
    },
    list: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
    card: {
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: radius.card,
      overflow: 'hidden',
      flexDirection: 'row',
      ...shadows.sm,
    },
    cardPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.997 }],
    },
    avatarSection: {
      width: 88,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: spacing.lg,
      overflow: 'hidden',
    },
    avatarImage: {
      ...StyleSheet.absoluteFillObject,
    },
    avatarText: {
      ...typography.title,
      color: groupAvatarTextColor,
      fontSize: 18,
      fontWeight: '600',
    },
    contentSection: {
      flex: 1,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      gap: 8,
      justifyContent: 'center',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    memberHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: radius.pill,
      backgroundColor: t.colors.background,
    },
    memberCount: {
      ...typography.micro,
      color: t.colors.textMuted,
    },
    name: { ...typography.subtitle, color: t.colors.text, flexShrink: 1 },
    metaChipsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flexWrap: 'wrap',
    },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: t.colors.background,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    metaChipText: {
      ...typography.micro,
      color: t.colors.textMuted,
    },
    actionStrip: {
      position: 'absolute',
      left: spacing.md,
      right: spacing.md,
      bottom: spacing.sm,
    },
  }),
);
