import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { PillButton } from '../components/PillButton';
import { GroupCardSkeleton, SkeletonList } from '../components/skeleton';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { useAuthStore, useGroupsStore } from '../store';
import { colors, spacing, typography } from '../theme';
import type { GroupsStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<GroupsStackParamList, 'GroupsMain'>;

export function GroupsScreen() {
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore((s) => s.getCurrentUserId());
  const groups = useGroupsStore((s) => s.groups);
  const memberships = useGroupsStore((s) => s.groupMemberships);
  const { configured, loading } = useSupabaseAuth();

  const myGroups = groups.filter((group) =>
    memberships.some((membership) => membership.groupId === group.id && membership.playerId === userId),
  );
  const memberCountByGroupId = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of memberships) {
      map.set(m.groupId, (map.get(m.groupId) ?? 0) + 1);
    }
    return map;
  }, [memberships]);
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
          const memberCount = memberCountByGroupId.get(item.id) ?? 0;
          return (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
              testID="groups:group:open"
              accessibilityRole="button"
              accessibilityLabel={`${item.name} grubunu aç, ${memberCount} üye`}
            >
              <View style={styles.cardRow}>
                <View style={styles.cardMain}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.meta}>Kod: {item.joinCode}</Text>
                </View>
                <View style={styles.memberHint} accessibilityElementsHidden>
                  <Ionicons name="people-outline" size={18} color={colors.textMuted} />
                  <Text style={styles.memberCount}>{memberCount}</Text>
                </View>
              </View>
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
    borderRadius: 14,
    padding: spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardMain: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  memberHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberCount: {
    ...typography.caption,
    color: colors.textMuted,
    minWidth: 20,
    textAlign: 'right',
  },
  name: { ...typography.subtitle, color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted },
});
