import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { MatchCard } from '../components/MatchCard';
import { useAppStore } from '../store/useAppStore';
import { colors, spacing, typography } from '../theme';
import { countGoing } from '../utils/matchRoster';
import type { GroupsStackParamList } from '../navigation/types';

type DetailRoute = RouteProp<GroupsStackParamList, 'GroupDetail'>;
type Nav = StackNavigationProp<GroupsStackParamList, 'GroupDetail'>;

export function GroupDetailScreen() {
  const route = useRoute<DetailRoute>();
  const navigation = useNavigation<Nav>();
  const { groupId } = route.params;
  const userId = useAppStore((s) => s.getCurrentUserId());
  const groups = useAppStore((s) => s.groups);
  const memberships = useAppStore((s) => s.groupMemberships);
  const matches = useAppStore((s) => s.matches);

  const group = groups.find((item) => item.id === groupId);
  const memberCount = memberships.filter((item) => item.groupId === groupId).length;
  const groupMatches = matches.filter((item) => item.groupId === groupId);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>{group?.name ?? 'Grup'}</Text>
        <Text style={styles.meta}>{memberCount} uye</Text>
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
