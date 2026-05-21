import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, UIManager, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { HomeActionCard } from '../components/HomeActionCard';
import { HomeLastMatchCard } from '../components/HomeLastMatchCard';
import { HomeUpcomingHeroCard } from '../components/HomeUpcomingHeroCard';
import { EmptyState } from '../components/EmptyState';
import {
  HomeActionStripSkeleton,
  HomeCalendarSkeleton,
  HomeHeroSkeleton,
  HomeLastMatchSkeleton,
  MatchCardSkeleton,
  SkeletonList,
} from '../components/skeleton';
import { resolveMyMatchesEntryScreen } from '../navigation/myMatchesEntry';
import {
  TAB_BAR_FLOAT_MARGIN_BOTTOM,
  TAB_BAR_FLOATING_BLOCK_HEIGHT,
  getHomeListPaddingBottom,
  getTabBarListPaddingBottom,
} from '../navigation/tabBarLayout';
import type { HomeStackParamList, RootTabParamList } from '../navigation/types';
import { spacing } from '../theme';
import { makeStyles } from '../theme/ThemeContext';
import { useMatchesStore, usePlayersStore } from '../store';
import { countGoing } from '../utils/matchRoster';
import { getLastFinishedMatchForPlayer } from '../utils/matchOutcome';
import type { Match } from '../types/domain';
import { HomeAgenda, type HomeAgendaHandle } from './Home/components/HomeAgenda';
import { HomeCalendar } from './Home/components/HomeCalendar';
import { HomeSegmentControl } from './Home/components/HomeSegmentControl';
import { useHomeMatchesData } from './Home/hooks/useHomeMatchesData';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>,
  BottomTabNavigationProp<RootTabParamList>
>;

const PROGRAMMATIC_SCROLL_GUARD_MS = 450;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const data = useHomeMatchesData();
  const getPlayer = usePlayersStore((s) => s.getPlayer);
  const allMatches = useMatchesStore((s) => s.matches);
  const agendaRef = useRef<HomeAgendaHandle>(null);
  const suppressPrimaryVisibleSyncRef = useRef(false);
  const skipNextAgendaScrollRef = useRef(false);
  const [calendarExpanded, setCalendarExpanded] = useState(false);

  useEffect(() => {
    if (!data.selectedDateKey) return;
    if (skipNextAgendaScrollRef.current) {
      skipNextAgendaScrollRef.current = false;
      return;
    }
    suppressPrimaryVisibleSyncRef.current = true;
    agendaRef.current?.scrollToDateKey(data.selectedDateKey);
    const t = setTimeout(() => {
      suppressPrimaryVisibleSyncRef.current = false;
    }, PROGRAMMATIC_SCROLL_GUARD_MS);
    return () => {
      clearTimeout(t);
      suppressPrimaryVisibleSyncRef.current = false;
    };
  }, [data.selectedDateKey, data.sections]);

  const handlePrimaryVisibleDateKeyChange = useCallback(
    (dateKey: string) => {
      if (dateKey === data.selectedDateKey) return;
      skipNextAgendaScrollRef.current = true;
      data.setSelectedDateKey(dateKey);
    },
    [data.selectedDateKey, data.setSelectedDateKey],
  );

  const nextMatch = useMemo<Match | null>(() => {
    const now = Date.now();
    const list = allMatches.filter((m) => {
      const t = new Date(m.startsAt).getTime();
      return m.status === 'upcoming' && t > now;
    });
    list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    return list[0] ?? null;
  }, [allMatches]);

  const lastMatch = useMemo(
    () => getLastFinishedMatchForPlayer(allMatches, data.userId),
    [allMatches, data.userId],
  );

  const userAttendee = nextMatch?.attendees.find((a) => a.playerId === data.userId);
  const userHasPaid = userAttendee?.paid === true;

  const handlePressMatch = useCallback(
    (match: Match) => {
      const dest = resolveMyMatchesEntryScreen(match, data.userId, data.ratingsSubmission);
      const params = { matchId: match.id };
      if (dest === 'MatchRatingFlow') navigation.navigate('MatchRatingFlow', params);
      else if (dest === 'MatchSummary') navigation.navigate('MatchSummary', params);
      else navigation.navigate('MatchDetail', params);
    },
    [navigation, data.userId, data.ratingsSubmission],
  );

  const handleGoToCreate = useCallback(() => {
    navigation.navigate('CreateTab');
  }, [navigation]);

  const handleOpenLastMatch = useCallback(() => {
    if (!lastMatch || !data.userId) return;
    const dest = resolveMyMatchesEntryScreen(lastMatch, data.userId, data.ratingsSubmission);
    const params = { matchId: lastMatch.id };
    if (dest === 'MatchRatingFlow') navigation.navigate('MatchRatingFlow', params);
    else if (dest === 'MatchSummary') navigation.navigate('MatchSummary', params);
    else navigation.navigate('MatchDetail', params);
  }, [lastMatch, navigation, data.userId, data.ratingsSubmission]);

  const handleToggleCalendar = useCallback(() => {
    setCalendarExpanded((prev) => !prev);
  }, []);

  const actionStripBottom =
    TAB_BAR_FLOATING_BLOCK_HEIGHT +
    TAB_BAR_FLOAT_MARGIN_BOTTOM +
    Math.max(insets.bottom, 8);
  const extraAgendaPadding =
    getHomeListPaddingBottom(insets.bottom) - getTabBarListPaddingBottom(insets.bottom);

  const listHeader = useMemo(
    () => (
      <View style={styles.header}>
        {lastMatch ? (
          <HomeLastMatchCard
            match={lastMatch}
            playerId={data.userId}
            onPress={handleOpenLastMatch}
          />
        ) : null}
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
        <View style={styles.controlsRow}>
          <HomeSegmentControl
            value={data.segment}
            onChange={data.setSegment}
            counts={data.segmentCounts}
          />
        </View>
        <View style={styles.calendarWrap}>
          <HomeCalendar
            monthAnchor={data.monthAnchor}
            selectedDateKey={data.selectedDateKey}
            today={data.today}
            dotsByDay={data.dotsByDay}
            onChangeMonth={data.shiftMonthBy}
            onSelectDay={data.setSelectedDateKey}
            expanded={calendarExpanded}
            onToggle={handleToggleCalendar}
          />
        </View>
      </View>
    ),
    [
      calendarExpanded,
      data.dotsByDay,
      data.monthAnchor,
      data.segment,
      data.segmentCounts,
      data.selectedDateKey,
      data.setSegment,
      data.setSelectedDateKey,
      data.shiftMonthBy,
      data.today,
      data.userId,
      getPlayer,
      handleOpenLastMatch,
      handleToggleCalendar,
      lastMatch,
      navigation,
      nextMatch,
      styles.calendarWrap,
      styles.controlsRow,
      styles.header,
      userAttendee?.status,
      userHasPaid,
    ],
  );

  if (data.showInitialSkeleton) {
    return (
      <View style={styles.screen}>
        <View style={styles.skeletonBody}>
          <HomeHeroSkeleton />
          <HomeLastMatchSkeleton />
          <HomeCalendarSkeleton />
          <View style={styles.skeletonGap} />
          <SkeletonList count={3} renderItem={() => <MatchCardSkeleton />} />
        </View>
        <View style={[styles.actionStrip, { bottom: actionStripBottom }]} pointerEvents="none">
          <HomeActionStripSkeleton />
        </View>
      </View>
    );
  }

  if (data.fetchError && data.sections.length === 0 && allMatches.length === 0) {
    return (
      <View style={styles.screen}>
        <View style={styles.errorStateWrap}>
          <EmptyState
            variant="connection-error"
            title="Bağlantı hatası"
            subtitle="Veriler yüklenemedi. İnternet bağlantınızı kontrol edin."
            actionLabel="Tekrar dene"
            onAction={data.refresh}
          />
        </View>
      </View>
    );
  }

  const emptyAction =
    data.segment === 'past' ? null : { label: 'Yeni Maç Oluştur', onPress: handleGoToCreate };

  return (
    <View style={styles.screen}>
      <Animated.View style={styles.fill} entering={FadeIn.duration(180)}>
        <HomeAgenda
          ref={agendaRef}
          sections={data.sections}
          segment={data.segment}
          refreshing={data.refreshing}
          onRefresh={data.refresh}
          userId={data.userId}
          selectedDateKey={data.selectedDateKey}
          suppressPrimaryVisibleSyncRef={suppressPrimaryVisibleSyncRef}
          onPrimaryVisibleDateKeyChange={handlePrimaryVisibleDateKeyChange}
          ListHeaderComponent={listHeader}
          onPressMatch={handlePressMatch}
          emptyAction={emptyAction}
          showNotGoingEmptyHint={data.sections.length === 0 && data.hasUpcomingNotGoingAttendance}
          onLoadMore={data.loadMore}
          loadingMore={data.loadingMore}
          hasMore={data.hasMoreMatches}
          extraListPaddingBottom={extraAgendaPadding}
        />
      </Animated.View>

      <View
        style={[styles.actionStrip, { bottom: actionStripBottom }]}
        pointerEvents="box-none"
      >
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
    fill: {
      flex: 1,
    },
    header: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      gap: spacing.md,
    },
    controlsRow: {
      marginTop: spacing.xs,
    },
    calendarWrap: {
      paddingBottom: spacing.xs,
    },
    skeletonBody: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      gap: spacing.md,
    },
    skeletonGap: {
      height: spacing.xs,
    },
    errorStateWrap: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    actionStrip: {
      position: 'absolute',
      left: spacing.md,
      right: spacing.md,
    },
  }),
);
