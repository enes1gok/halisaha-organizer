import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { MatchCard } from '../components/MatchCard';
import { PillButton } from '../components/PillButton';
import { useAuthStore, useGroupsStore, useMatchesStore } from '../store';
import { colors, spacing, typography } from '../theme';
import { countGoing } from '../utils/matchRoster';
import type { GroupsStackParamList } from '../navigation/types';

type DetailRoute = RouteProp<GroupsStackParamList, 'GroupDetail'>;
type Nav = StackNavigationProp<GroupsStackParamList, 'GroupDetail'>;

export function GroupDetailScreen() {
  const route = useRoute<DetailRoute>();
  const navigation = useNavigation<Nav>();
  const { groupId } = route.params;
  const userId = useAuthStore((s) => s.getCurrentUserId());
  const groups = useGroupsStore((s) => s.groups);
  const memberships = useGroupsStore((s) => s.groupMemberships);
  const matches = useMatchesStore((s) => s.matches);

  const group = groups.find((item) => item.id === groupId);
  const isOwner = group?.ownerId === userId;
  const isMember = memberships.some((item) => item.groupId === groupId && item.playerId === userId);
  const memberCount = memberships.filter((item) => item.groupId === groupId).length;
  const groupMatches = useMemo(
    () => matches.filter((item) => item.groupId === groupId),
    [matches, groupId],
  );

  if (!group || !isMember) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>Bu grubu goruntuleme yetkin yok.</Text>
          <Text style={styles.meta}>Grup disi katilimciysan mac detayindan kadroyu gorebilirsin.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>{group.name}</Text>
        <Text style={styles.meta}>{memberCount} uye</Text>
        <PillButton
          title="Liderlik Tablosu"
          variant="ghost"
          onPress={() => navigation.navigate('GroupLeaderboard', { groupId })}
          testID="groups:leaderboard:open"
        />
        {isOwner ? (
          <PillButton
            title="Haftalık maç tekrarı"
            variant="ghost"
            onPress={() => navigation.navigate('GroupWeeklySeries', { groupId })}
            testID="groups:weekly:open"
          />
        ) : null}
      </View>
      <FlatList
        contentContainerStyle={styles.list}
        data={groupMatches}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>Bu grupta henuz planlanan mac yok.</Text>}
        renderItem={({ item }) => (
          <MatchCard
            match={item}
            goingCount={countGoing(item)}
            userGoing={item.attendees.some((att) => att.playerId === userId && att.status === 'going')}
            onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  title: { ...typography.title, color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted },
  list: { padding: spacing.md, gap: spacing.md, flexGrow: 1 },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});
