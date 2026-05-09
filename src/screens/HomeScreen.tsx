import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  LayoutAnimation,
  Platform,
  RefreshControl,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';
import { HomeActionCard } from '../components/HomeActionCard';
import { HomeUpcomingHeroCard } from '../components/HomeUpcomingHeroCard';
import { MatchCard } from '../components/MatchCard';
import { HomeActionStripSkeleton, HomeHeroSkeleton, MatchCardSkeleton, SkeletonList } from '../components/skeleton';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { colors, spacing } from '../theme';
import { countGoing } from '../utils/matchRoster';
import { useAuthStore, useMatchesStore, usePlayersStore } from '../store';
import { HOME_LIST_PADDING_BOTTOM_EXTRA } from '../navigation/tabBarLayout';
import type { HomeStackParamList, RootTabParamList } from '../navigation/types';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Nav = CompositeNavigationProp<
  StackNavigationProp<HomeStackParamList, 'HomeMain'>,
  BottomTabNavigationProp<RootTabParamList>
>;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore((s) => s.getCurrentUserId());
  const matches = useMatchesStore((s) => s.matches);
  const getPlayer = usePlayersStore((s) => s.getPlayer);
  const remoteUserId = useAuthStore((s) => s.remoteUserId);
  const hydrateRemoteMatches = useMatchesStore((s) => s.hydrateRemoteMatches);
  const { configured, loading } = useSupabaseAuth();
  const [refreshing, setRefreshing] = useState(false);

  const upcoming = useMemo(() => {
    const list = matches.filter((m) => m.status === 'upcoming');
    return [...list].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [matches]);

  const nextMatch = upcoming[0] ?? null;
  const restUpcoming = upcoming.length > 1 ? upcoming.slice(1) : [];

  const onRefresh = useCallback(async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRefreshing(true);
    try {
      if (remoteUserId) await hydrateRemoteMatches();
    } finally {
      setRefreshing(false);
    }
  }, [hydrateRemoteMatches, remoteUserId]);

  const organizerName = nextMatch ? getPlayer(nextMatch.organizerId)?.name : undefined;
  const userAttendee = nextMatch?.attendees.find((a) => a.playerId === userId);
  const userHasPaid = userAttendee?.paid === true;

  const listHeader = useMemo(
    () => (
      <HomeUpcomingHeroCard
        match={nextMatch}
        goingCount={nextMatch ? countGoing(nextMatch) : 0}
        organizerName={organizerName}
        userHasPaid={userHasPaid}
        getPlayer={getPlayer}
        onOpenDetail={() => {
          if (nextMatch) navigation.navigate('MatchDetail', { matchId: nextMatch.id });
        }}
      />
    ),
    [getPlayer, navigation, nextMatch, organizerName, userHasPaid],
  );

  const showInitialSkeleton = configured && loading && matches.length === 0;

  if (showInitialSkeleton) {
    return (
      <View style={styles.screen}>
        <View style={styles.list}>
          <HomeHeroSkeleton />
          <SkeletonList count={3} renderItem={() => <MatchCardSkeleton />} />
        </View>
        <View style={styles.actionStrip} pointerEvents="none">
          <HomeActionStripSkeleton />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={restUpcoming}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        renderItem={({ item }) => {
          const goingC = countGoing(item);
          const mine = item.attendees.find((a) => a.playerId === userId);
          const userGoing = mine?.status === 'going';
          return (
            <MatchCard
              match={item}
              goingCount={goingC}
              userGoing={userGoing}
              onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })}
            />
          );
        }}
        ListEmptyComponent={null}
      />

      <View style={styles.actionStrip} pointerEvents="box-none">
        <HomeActionCard
          onJoinPress={() => navigation.navigate('JoinMatch')}
          onCreatePress={() => navigation.navigate('CreateTab')}
        />
      </View>
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
    paddingBottom: HOME_LIST_PADDING_BOTTOM_EXTRA,
    flexGrow: 1,
  },
  actionStrip: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.sm,
  },
});
