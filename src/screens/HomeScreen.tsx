import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  LayoutAnimation,
  Platform,
  RefreshControl,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeActionCard } from '../components/HomeActionCard';
import { HomeLastMatchCard } from '../components/HomeLastMatchCard';
import { HomeUpcomingHeroCard } from '../components/HomeUpcomingHeroCard';
import { MatchCard } from '../components/MatchCard';
import { MatchCardListRow } from '../components/MatchCardListRow';
import { EmptyState } from '../components/EmptyState';
import {
  HomeActionStripSkeleton,
  HomeHeroSkeleton,
  HomeLastMatchSkeleton,
  MatchCardSkeleton,
  SkeletonList,
} from '../components/skeleton';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { spacing } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { countGoing } from '../utils/matchRoster';
import { getLastFinishedMatchForPlayer } from '../utils/matchOutcome';
import { useAuthStore, useMatchesStore, usePlayersStore } from '../store';
import { getHomeActionStripBottom, getHomeListPaddingBottom } from '../navigation/tabBarLayout';
import type { HomeStackParamList, RootTabParamList } from '../navigation/types';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>,
  BottomTabNavigationProp<RootTabParamList>
>;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const userId = useAuthStore((s) => s.getCurrentUserId());
  const matches = useMatchesStore((s) => s.matches);
  const getPlayer = usePlayersStore((s) => s.getPlayer);
  const remoteUserId = useAuthStore((s) => s.remoteUserId);
  const hydrateRemoteMatches = useMatchesStore((s) => s.hydrateRemoteMatches);
  const { configured, loading } = useSupabaseAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [skeletonExpired, setSkeletonExpired] = useState(false);
  const listPaddingBottom = getHomeListPaddingBottom(insets.bottom);

  useEffect(() => {
    if (!showInitialSkeleton) return;
    const timer = setTimeout(() => setSkeletonExpired(true), 8_000);
    return () => clearTimeout(timer);
  }, [configured, loading, matches.length]);

  const showInitialSkeleton = configured && loading && matches.length === 0 && !skeletonExpired;

  const upcoming = useMemo(() => {
    const list = matches.filter((m) => m.status === 'upcoming');
    return [...list].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [matches]);

  const nextMatch = upcoming[0] ?? null;
  const restUpcoming = upcoming.length > 1 ? upcoming.slice(1) : [];

  const lastMatch = useMemo(
    () => getLastFinishedMatchForPlayer(matches, userId),
    [matches, userId],
  );

  const onRefresh = useCallback(async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRefreshing(true);
    setFetchError(false);
    try {
      if (remoteUserId) await hydrateRemoteMatches({ force: true });
    } catch (e) {
      console.warn('HomeScreen refresh failed', e);
      setFetchError(true);
    } finally {
      setRefreshing(false);
    }
  }, [hydrateRemoteMatches, remoteUserId]);

  const userAttendee = nextMatch?.attendees.find((a) => a.playerId === userId);
  const userHasPaid = userAttendee?.paid === true;

  const listHeader = useMemo(
    () => (
      <View>
        <HomeUpcomingHeroCard
          match={nextMatch}
          goingCount={nextMatch ? countGoing(nextMatch) : 0}
          userRsvp={userAttendee?.status ?? null}
          userHasPaid={userHasPaid}
          getPlayer={getPlayer}
          onOpenDetail={() => {
            if (nextMatch) navigation.navigate('MatchDetail', { matchId: nextMatch.id });
          }}
        />
        {lastMatch ? (
          <HomeLastMatchCard
            match={lastMatch}
            playerId={userId}
            onPress={() => navigation.navigate('MatchDetail', { matchId: lastMatch.id })}
          />
        ) : null}
      </View>
    ),
    [getPlayer, lastMatch, navigation, nextMatch, userHasPaid, userId],
  );

  if (showInitialSkeleton) {
    return (
      <View style={styles.screen}>
        <View style={[styles.list, { paddingBottom: listPaddingBottom }]}>
          <HomeHeroSkeleton />
          <HomeLastMatchSkeleton />
          <SkeletonList count={3} renderItem={() => <MatchCardSkeleton />} />
        </View>
        <View style={[styles.actionStrip, { bottom: getHomeActionStripBottom(insets.bottom) }]} pointerEvents="none">
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
        contentContainerStyle={[styles.list, { paddingBottom: listPaddingBottom }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        renderItem={({ item }) => {
          const goingC = countGoing(item);
          const mine = item.attendees.find((a) => a.playerId === userId);
          return (
            <MatchCardListRow matchId={item.id}>
              <MatchCard
                match={item}
                goingCount={goingC}
                userRsvp={mine?.status ?? null}
                onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })}
              />
            </MatchCardListRow>
          );
        }}
        ListEmptyComponent={
          fetchError && matches.length === 0 ? (
            <EmptyState
              variant="connection-error"
              title="Bağlantı hatası"
              subtitle="Veriler yüklenemedi. İnternet bağlantınızı kontrol edin."
              actionLabel="Tekrar dene"
              onAction={onRefresh}
            />
          ) : null
        }
      />

      <View style={[styles.actionStrip, { bottom: getHomeActionStripBottom(insets.bottom) }]} pointerEvents="box-none">
        <HomeActionCard
          onJoinPress={() => navigation.navigate('JoinMatch')}
          onCreatePress={() => navigation.navigate('CreateTab')}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    list: {
      padding: spacing.md,
      flexGrow: 1,
    },
    actionStrip: {
      position: 'absolute',
      left: spacing.md,
      right: spacing.md,
      bottom: spacing.sm,
    },
  }),
);
