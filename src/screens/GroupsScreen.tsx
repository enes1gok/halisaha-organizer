import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { PillButton } from '../components/PillButton';
import { GroupCardSkeleton, SkeletonList } from '../components/skeleton';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { useAuthStore, useGroupsStore } from '../store';
import { colors, spacing, typography } from '../theme';
import type { GroupsStackParamList } from '../navigation/types';

type Nav = StackNavigationProp<GroupsStackParamList, 'GroupsMain'>;

export function GroupsScreen() {
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore((s) => s.getCurrentUserId());
  const groups = useGroupsStore((s) => s.groups);
  const memberships = useGroupsStore((s) => s.groupMemberships);
  const { configured, loading } = useSupabaseAuth();

  const myGroups = groups.filter((group) =>
    memberships.some((membership) => membership.groupId === group.id && membership.playerId === userId),
  );
  const showInitialSkeleton = configured && loading && groups.length === 0 && memberships.length === 0;

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
          ) : (
            <Text style={styles.empty}>Henüz bir grubun yok. Yeni grup oluşturabilirsin.</Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
            testID="groups:group:open"
            accessibilityRole="button"
            accessibilityLabel={`${item.name} grubunu aç`}
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>Kod: {item.joinCode}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  actions: { padding: spacing.md, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  list: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.xs,
  },
  name: { ...typography.subtitle, color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});
