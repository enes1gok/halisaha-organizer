import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  LayoutAnimation,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { MatchCard } from '../components/MatchCard';
import { colors, spacing, typography } from '../theme';
import type { Match } from '../types/domain';
import { computeWinStreak } from '../utils/stats';
import { useAppStore } from '../store/useAppStore';
import { TAB_BAR_LIST_PADDING_BOTTOM } from '../navigation/tabBarLayout';
import type { HomeStackParamList, RootTabParamList } from '../navigation/types';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>,
  BottomTabNavigationProp<RootTabParamList>
>;

function countGoing(m: Match): number {
  return m.attendees.filter((a) => a.status === 'going').length;
}

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const userId = useAppStore((s) => s.getCurrentUserId());
  const players = useAppStore((s) => s.players);
  const matches = useAppStore((s) => s.matches);
  const [refreshing, setRefreshing] = useState(false);

  const me = useMemo(() => players.find((p) => p.id === userId), [players, userId]);

  const upcoming = useMemo(() => {
    const list = matches.filter((m) => m.status === 'upcoming');
    return [...list].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [matches]);

  const streak = useMemo(() => computeWinStreak(matches, userId), [matches, userId]);

  const onRefresh = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  const winPct = me
    ? Math.round(
        (me.stats.wins / Math.max(1, me.stats.wins + me.stats.losses + me.stats.draws)) * 100,
      )
    : 0;

  return (
    <View style={styles.screen}>
      <View style={styles.statsBar}>
        <View style={styles.statCell}>
          <Text style={styles.statVal}>{me?.stats.goals ?? 0}</Text>
          <Text style={styles.statLbl}>Gol</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statVal}>{me?.stats.assists ?? 0}</Text>
          <Text style={styles.statLbl}>Asist</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statVal}>{streak}</Text>
          <Text style={styles.statLbl}>Seri</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statVal}>{winPct}%</Text>
          <Text style={styles.statLbl}>Galibiyet</Text>
        </View>
      </View>

      <FlatList
        data={upcoming}
        keyExtractor={(item) => item.id}
        contentContainerStyle={upcoming.length === 0 ? [styles.list, styles.listEmpty] : styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListEmptyComponent={
          <EmptyState
            title="Yaklaşan maç yok"
            subtitle="Yeni maç oluşturun veya bir davetiye ile katılın."
            actionLabel="Maç Oluştur"
            onAction={() => navigation.navigate('CreateTab')}
          />
        }
        renderItem={({ item }) => {
          const goingCount = countGoing(item);
          const mine = item.attendees.find((a) => a.playerId === userId);
          const userGoing = mine?.status === 'going';
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
  statsBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statCell: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  statVal: {
    ...typography.subtitle,
    color: colors.accent,
  },
  statLbl: {
    ...typography.micro,
    color: colors.textMuted,
    marginTop: 2,
  },
  list: {
    padding: spacing.md,
    paddingBottom: TAB_BAR_LIST_PADDING_BOTTOM,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: TAB_BAR_LIST_PADDING_BOTTOM,
  },
});
