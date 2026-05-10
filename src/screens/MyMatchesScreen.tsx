import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { MatchCardSkeleton, MyMatchesCalendarSkeleton, SkeletonList } from '../components/skeleton';
import { TAB_BAR_LIST_PADDING_BOTTOM } from '../navigation/tabBarLayout';
import { resolveMyMatchesEntryScreen } from '../navigation/myMatchesEntry';
import type { MyMatchesStackParamList } from '../navigation/types';
import { spacing } from '../theme';
import { makeStyles } from '../theme/ThemeContext';
import type { Match } from '../types/domain';
import { MyMatchesAgenda, type MyMatchesAgendaHandle } from './MyMatches/components/MyMatchesAgenda';
import { MyMatchesCalendar } from './MyMatches/components/MyMatchesCalendar';
import { MyMatchesSegmentControl } from './MyMatches/components/MyMatchesSegmentControl';
import { useMyMatchesData } from './MyMatches/hooks/useMyMatchesData';

type Nav = NativeStackNavigationProp<MyMatchesStackParamList, 'MyMatchesMain'>;

const PROGRAMMATIC_SCROLL_GUARD_MS = 450;

export function MyMatchesScreen() {
  const navigation = useNavigation<Nav>();
  const data = useMyMatchesData();
  const styles = useStyles();
  const agendaRef = useRef<MyMatchesAgendaHandle>(null);
  const suppressPrimaryVisibleSyncRef = useRef(false);
  const skipNextAgendaScrollRef = useRef(false);

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

  const handlePressMatch = useCallback(
    (match: Match) => {
      const dest = resolveMyMatchesEntryScreen(match, data.userId, data.ratingsSubmission);
      const params = { matchId: match.id };
      if (dest === 'MatchPostgame') navigation.navigate('MatchPostgame', params);
      else if (dest === 'MatchSummary') navigation.navigate('MatchSummary', params);
      else navigation.navigate('MatchDetail', params);
    },
    [navigation, data.userId, data.ratingsSubmission],
  );

  const handleGoToCreate = useCallback(() => {
    navigation.getParent()?.navigate('CreateTab' as never);
  }, [navigation]);

  const handleGoToHome = useCallback(() => {
    navigation.getParent()?.navigate('HomeTab' as never);
  }, [navigation]);

  if (data.showInitialSkeleton) {
    return (
      <View style={styles.screen}>
        <View style={styles.headerStack}>
          <MyMatchesSegmentControl
            value={data.segment}
            onChange={data.setSegment}
            counts={data.segmentCounts}
          />
        </View>
        <View style={styles.skeletonBody}>
          <MyMatchesCalendarSkeleton />
          <View style={styles.skeletonGap} />
          <SkeletonList count={3} renderItem={() => <MatchCardSkeleton />} />
        </View>
      </View>
    );
  }

  const listHeader = (
    <View style={styles.calendarWrap}>
      <MyMatchesCalendar
        monthAnchor={data.monthAnchor}
        selectedDateKey={data.selectedDateKey}
        today={data.today}
        dotsByDay={data.dotsByDay}
        onChangeMonth={data.shiftMonthBy}
        onSelectDay={data.setSelectedDateKey}
        onResetToToday={data.resetToToday}
      />
    </View>
  );

  const emptyAction =
    data.segment === 'past'
      ? null
      : data.segment === 'upcoming'
        ? { label: 'Yeni Maç Oluştur', onPress: handleGoToCreate }
        : { label: 'Ana Sayfaya Git', onPress: handleGoToHome };

  return (
    <View style={styles.screen}>
      <View style={styles.headerStack}>
        <MyMatchesSegmentControl
          value={data.segment}
          onChange={data.setSegment}
          counts={data.segmentCounts}
        />
      </View>
      <MyMatchesAgenda
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
      />
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    headerStack: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
    },
    calendarWrap: {
      paddingBottom: spacing.xs,
    },
    skeletonBody: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: TAB_BAR_LIST_PADDING_BOTTOM,
    },
    skeletonGap: {
      height: spacing.md,
    },
  }),
);
