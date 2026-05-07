import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { MatchCard } from '../components/MatchCard';
import { TAB_BAR_LIST_PADDING_BOTTOM } from '../navigation/tabBarLayout';
import { colors, spacing } from '../theme';
import { countGoing } from '../utils/matchRoster';
import { useAuthStore, useMatchesStore } from '../store';
import type { MyMatchesStackParamList } from '../navigation/types';

type Nav = StackNavigationProp<MyMatchesStackParamList, 'MyMatchesMain'>;

export function MyMatchesScreen() {
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore((s) => s.getCurrentUserId());
  const matches = useMatchesStore((s) => s.matches);
  const remoteUserId = useAuthStore((s) => s.remoteUserId);
  const hydrateRemoteMatches = useMatchesStore((s) => s.hydrateRemoteMatches);
  const [refreshing, setRefreshing] = useState(false);

  const mine = useMemo(() => {
    const list = matches.filter((m) => {
      if (m.organizerId === userId) return true;
      const att = m.attendees.find((a) => a.playerId === userId);
      return att && (att.status === 'going' || att.status === 'maybe');
    });
    return [...list].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [matches, userId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (remoteUserId) await hydrateRemoteMatches();
    } finally {
      setRefreshing(false);
    }
  }, [hydrateRemoteMatches, remoteUserId]);

  return (
    <View style={styles.screen}>
      <FlatList
        data={mine}
        keyExtractor={(item) => item.id}
        contentContainerStyle={mine.length === 0 ? styles.emptyWrap : styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          <EmptyState
            title="Henüz maçın yok"
            subtitle="Ana sayfadan bir maça katılın veya yeni maç oluşturun."
            actionLabel="Ana Sayfaya Git"
            onAction={() => navigation.getParent()?.navigate('HomeTab' as never)}
          />
        }
        renderItem={({ item }) => {
          const goingCount = countGoing(item);
          const att = item.attendees.find((a) => a.playerId === userId);
          const userGoing = att?.status === 'going';
          return (
            <MatchCard
              match={item}
              goingCount={goingCount}
              userGoing={userGoing}
              onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })}
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: spacing.md,
    paddingBottom: TAB_BAR_LIST_PADDING_BOTTOM,
  },
  emptyWrap: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: TAB_BAR_LIST_PADDING_BOTTOM,
  },
});
