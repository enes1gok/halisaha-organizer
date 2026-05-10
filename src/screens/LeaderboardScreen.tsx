import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { LeaderboardPodium } from '../components/LeaderboardPodium';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { LeaderboardRowSkeleton, SkeletonList } from '../components/skeleton';
import {
  TAB_BAR_LIST_PADDING_BOTTOM,
  TAB_BAR_LIST_PADDING_PINNED_EXTRA,
} from '../navigation/tabBarLayout';
import { spacing, typography } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useAuthStore, useMatchesStore, usePlayersStore } from '../store';
import type { GroupsStackParamList, RootTabParamList } from '../navigation/types';
import { fetchPlayerLeaderboardStats } from '../services/supabase/leaderboard';
import { toUserMessage } from '../services/supabase/errors';
import {
  buildLeaderboard,
  metricLabel,
  timeframeLabel,
  type LeaderMetric,
  type Timeframe,
} from '../utils/leaderboard';

type GroupLeaderboardRoute = RouteProp<GroupsStackParamList, 'GroupLeaderboard'>;

function Chip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{label}</Text>
    </Pressable>
  );
}

export function LeaderboardScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useStyles();
  const route = useRoute<GroupLeaderboardRoute>();
  const groupId = route.params?.groupId;
  const players = usePlayersStore((s) => s.players);
  const matches = useMatchesStore((s) => s.matches);
  const userId = useAuthStore((s) => s.getCurrentUserId());
  const remoteUserId = useAuthStore((s) => s.remoteUserId);
  const hydrateRemoteMatches = useMatchesStore((s) => s.hydrateRemoteMatches);

  const [metric, setMetric] = useState<LeaderMetric>('goals');
  const [tf, setTf] = useState<Timeframe>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [remoteRows, setRemoteRows] = useState<{ playerId: string; value: number; rank: number }[] | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!remoteUserId) {
      setRemoteRows(null);
      setRemoteLoading(false);
      return;
    }
    setRemoteLoading(true);
    void fetchPlayerLeaderboardStats(tf, new Date().toISOString(), groupId ?? null, metric)
      .then((stats) => {
        if (cancelled) return;
        const byMetric = stats.map((row) => {
          const value =
            metric === 'goals'
              ? row.goals
              : metric === 'assists'
                ? row.assists
                : metric === 'matches'
                  ? row.matches_played
                  : row.matches_played === 0
                    ? 0
                    : row.wins / row.matches_played;
          return { playerId: row.player_id, value };
        });
        const sorted = byMetric.sort((a, b) => b.value - a.value).map((item, index) => ({
          ...item,
          rank: index + 1,
        }));
        setRemoteRows(sorted);
      })
      .catch((error) => {
        if (cancelled) return;
        setRemoteRows(null);
        Alert.alert('Hata', toUserMessage(error, 'Liderlik verileri alınamadı.'));
      })
      .finally(() => {
        if (cancelled) return;
        setRemoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, metric, remoteUserId, tf]);

  const localRows = useMemo(
    () => buildLeaderboard(players, matches, metric, tf, new Date(), groupId),
    [players, matches, metric, tf, groupId],
  );

  const rows = remoteRows ?? localRows;

  const top = rows.slice(0, 10);
  const podium = top.slice(0, 3);
  const rest = top.slice(3);
  const mine = rows.find((r) => r.playerId === userId);
  const showPinned = !!(mine && mine.rank > 10);
  const me = players.find((p) => p.id === userId);

  const fmt = (v: number) =>
    metric === 'winRate' ? `${Math.round(v * 100)}%` : `${Math.round(v)}`;
  const showInitialSkeleton = !!remoteUserId && remoteLoading && remoteRows == null;

  const openCreateMatch = () => {
    navigation.getParent<BottomTabNavigationProp<RootTabParamList>>()?.navigate('CreateTab');
  };

  const podiumHeader =
    !showInitialSkeleton && podium.length > 0 ? (
      <LeaderboardPodium
        entries={podium}
        resolvePlayer={(playerId) => {
          const pl = players.find((x) => x.id === playerId);
          return pl ? { name: pl.name, photoUri: pl.photoUri } : undefined;
        }}
        formatValue={fmt}
      />
    ) : null;

  return (
    <View style={styles.screen}>
      <View style={styles.toggleBlock}>
        <Text style={styles.toggleHdr}>Metrik</Text>
        <View style={styles.rowWrap}>
          {(['goals', 'assists', 'winRate', 'matches'] as LeaderMetric[]).map((m) => (
            <Chip
              key={m}
              active={metric === m}
              label={metricLabel(m)}
              onPress={() => setMetric(m)}
            />
          ))}
        </View>
        <Text style={[styles.toggleHdr, styles.mt]}>Zaman</Text>
        <View style={styles.rowWrap}>
          {(['all', 'month', 'week'] as Timeframe[]).map((t) => (
            <Chip
              key={t}
              active={tf === t}
              label={timeframeLabel(t)}
              onPress={() => setTf(t)}
            />
          ))}
        </View>
      </View>

      <FlatList
        style={styles.flexFill}
        data={showInitialSkeleton ? [] : rest}
        keyExtractor={(item) => item.playerId}
        ListHeaderComponent={podiumHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                if (remoteUserId) await hydrateRemoteMatches();
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={colors.accent}
          />
        }
        contentContainerStyle={[
          styles.list,
          {
            paddingBottom: showPinned
              ? TAB_BAR_LIST_PADDING_BOTTOM + TAB_BAR_LIST_PADDING_PINNED_EXTRA
              : TAB_BAR_LIST_PADDING_BOTTOM,
          },
        ]}
        ListEmptyComponent={
          showInitialSkeleton ? (
            <SkeletonList count={8} renderItem={() => <LeaderboardRowSkeleton />} />
          ) : top.length === 0 ? (
            <EmptyState
              title="Sıralama için veri yok"
              subtitle="İlk maçını oyna ve sıralamaya gir!"
              actionLabel="Maç oluştur"
              onAction={openCreateMatch}
              actionTestID="leaderboard:empty:create-match:press"
            />
          ) : null
        }
        renderItem={({ item }) => {
          const p = players.find((x) => x.id === item.playerId);
          if (!p) return null;
          return (
            <View style={styles.row}>
              <Text style={styles.rank}>{item.rank}</Text>
              <PlayerAvatar name={p.name} uri={p.photoUri} size={40} />
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.val}>{fmt(item.value)}</Text>
            </View>
          );
        }}
      />

      {showPinned && mine ? (
        <View style={styles.pinned}>
          <Text style={styles.pinnedLbl}>Sen</Text>
          <PlayerAvatar name={me?.name ?? ''} uri={me?.photoUri} size={36} />
          <Text style={styles.name}>{me?.name}</Text>
          <Text style={styles.val}>{fmt(mine.value)}</Text>
          <Text style={styles.rankSm}>#{mine.rank}</Text>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    flexFill: {
      flex: 1,
    },
    toggleBlock: {
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
      gap: spacing.sm,
    },
    toggleHdr: {
      ...typography.caption,
      color: t.colors.textMuted,
    },
    mt: {
      marginTop: spacing.sm,
    },
    rowWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    chipActive: {
      borderColor: t.colors.accent,
      backgroundColor: t.colors.accentMuted,
    },
    chipTxt: {
      ...typography.caption,
      color: t.colors.textMuted,
    },
    chipTxtActive: {
      color: t.colors.accent,
      fontFamily: 'Inter_600SemiBold',
    },
    list: {
      padding: spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    rank: {
      ...typography.body,
      color: t.colors.textMuted,
      width: 28,
      fontFamily: 'Inter_700Bold',
    },
    name: {
      ...typography.body,
      color: t.colors.text,
      flex: 1,
    },
    val: {
      ...typography.subtitle,
      color: t.colors.accent,
      minWidth: 48,
      textAlign: 'right',
      fontFamily: 'Inter_700Bold',
    },
    pinned: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    pinnedLbl: {
      ...typography.micro,
      color: t.colors.accent,
      fontFamily: 'Inter_700Bold',
      width: 36,
    },
    rankSm: {
      ...typography.caption,
      color: t.colors.textMuted,
    },
  }),
);
