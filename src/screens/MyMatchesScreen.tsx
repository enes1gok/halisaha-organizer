import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { MatchCard } from '../components/MatchCard';
import { MatchCardSkeleton, SkeletonList } from '../components/skeleton';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { TAB_BAR_LIST_PADDING_BOTTOM } from '../navigation/tabBarLayout';
import { resolveMyMatchesEntryScreen } from '../navigation/myMatchesEntry';
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
  const { configured, loading } = useSupabaseAuth();
  const ratingsSubmission = useMatchesStore((s) => s.matchRatingsSubmissionByMatchId);
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

  const showInitialSkeleton = configured && loading && matches.length === 0;

  return (
    <View style={styles.screen}>
      {showInitialSkeleton ? (
        <View style={styles.list}>
          <SkeletonList count={4} renderItem={() => <MatchCardSkeleton />} />
        </View>
      ) : (
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
              onPress={() => {
                const dest = resolveMyMatchesEntryScreen(item, userId, ratingsSubmission);
                const p = { matchId: item.id };
                if (dest === 'MatchPregame') navigation.navigate('MatchPregame', p);
                else if (dest === 'MatchPostgame') navigation.navigate('MatchPostgame', p);
                else if (dest === 'MatchSummary') navigation.navigate('MatchSummary', p);
                else navigation.navigate('MatchDetail', p);
              }}
            />
          );
        }}
      />
      )}
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
