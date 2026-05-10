import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { PillButton } from '../components/PillButton';
import { GroupCardSkeleton, SkeletonList } from '../components/skeleton';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { useAuthStore, useGroupsStore, useMatchesStore } from '../store';
import { colors, radius, shadows, spacing, typography } from '../theme';
import { formatShortDate } from '../utils/dates';
import type { GroupsStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<GroupsStackParamList, 'GroupsMain'>;

const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

interface GroupListMeta {
  upcomingCount: number;
  lastFinishedAt: string | null;
  activeMemberCount: number;
  totalMemberCount: number;
}

export function GroupsScreen() {
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore((s) => s.getCurrentUserId());
  const groups = useGroupsStore((s) => s.groups);
  const memberships = useGroupsStore((s) => s.groupMemberships);
  const matches = useMatchesStore((s) => s.matches);
  const { configured, loading } = useSupabaseAuth();

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

  const showInitialSkeleton = configured && loading && groups.length === 0 && memberships.length === 0;
  const showCenteredEmptyCTAs = !showInitialSkeleton && myGroups.length === 0;

  if (showCenteredEmptyCTAs) {
    return (
      <View style={styles.screen}>
        <View style={styles.centeredEmpty}>
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
      <View style={styles.actions}>
        <PillButton
          title="Grup Oluştur"
          onPress={() => navigation.navigate('CreateGroup')}
          testID="groups:create:press"
          accessibilityLabel="Grup oluştur"
        />
        <PillButton
          title="Kod ile Katıl"
          variant="ghost"
          onPress={() => navigation.navigate('JoinGroup')}
          testID="groups:join:press"
          accessibilityLabel="Kod ile gruba katıl"
        />
      </View>

      <FlatList
        contentContainerStyle={styles.list}
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
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
              testID="groups:group:open"
              accessibilityRole="button"
              accessibilityLabel={a11yLabel}
            >
              <View style={styles.cardHeaderRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.memberHint} accessibilityElementsHidden>
                  <Ionicons name="people-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.memberCount}>{meta.totalMemberCount}</Text>
                </View>
              </View>

              <View
                style={styles.metaChipsRow}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <View style={styles.metaChip}>
                  <Ionicons name="calendar-outline" size={12} color={colors.accent} />
                  <Text style={styles.metaChipText} numberOfLines={1}>
                    {meta.upcomingCount} yaklaşan
                  </Text>
                </View>
                <View style={styles.metaChip}>
                  <Ionicons name="flag-outline" size={12} color={colors.textMuted} />
                  <Text style={styles.metaChipText} numberOfLines={1}>
                    {lastFinishedLabel ? `Son: ${lastFinishedLabel}` : 'Henüz maç yok'}
                  </Text>
                </View>
                <View style={styles.metaChip}>
                  <Ionicons name="pulse-outline" size={12} color={colors.textMuted} />
                  <Text style={styles.metaChipText} numberOfLines={1}>
                    {meta.activeMemberCount} aktif (30g)
                  </Text>
                </View>
              </View>

              <Text style={styles.codeMeta}>Kod: {item.joinCode}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centeredEmpty: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
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
    color: colors.textMuted,
    textAlign: 'left',
  },
  ctaButton: {
    alignSelf: 'stretch',
    width: '100%',
  },
  actions: { padding: spacing.md, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  list: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.sm,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.997 }],
  },
  cardHeaderRow: {
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
    backgroundColor: colors.surfaceSoft,
  },
  memberCount: {
    ...typography.micro,
    color: colors.textMuted,
  },
  name: { ...typography.subtitle, color: colors.text, flexShrink: 1 },
  metaChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaChipText: {
    ...typography.micro,
    color: colors.textMuted,
  },
  codeMeta: { ...typography.caption, color: colors.textMuted },
});
