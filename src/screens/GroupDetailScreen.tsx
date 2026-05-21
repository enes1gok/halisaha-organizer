import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useLayoutEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MatchCard } from '../components/MatchCard';
import { MatchCardListRow } from '../components/MatchCardListRow';
import { PillButton } from '../components/PillButton';
import { MatchCardSkeleton, SettingsSectionSkeleton, SkeletonList, SkeletonText } from '../components/skeleton';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { getTabBarListPaddingBottom } from '../navigation/tabBarLayout';
import { resolveMyMatchesEntryScreen } from '../navigation/myMatchesEntry';
import type { GroupsStackParamList } from '../navigation/types';
import { useAuthStore, useGroupsStore, useMatchesStore } from '../store';
import { spacing, typography } from '../theme';
import { makeStyles } from '../theme/ThemeContext';
import { countGoing } from '../utils/matchRoster';

type DetailRoute = RouteProp<GroupsStackParamList, 'GroupDetail'>;
type Nav = NativeStackNavigationProp<GroupsStackParamList, 'GroupDetail'>;

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.background },
    deniedWrap: {
      padding: spacing.md,
      gap: spacing.xs,
    },
    listContent: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      gap: spacing.md,
      flexGrow: 1,
    },
    listHeader: {
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    titleBlock: {
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    title: { ...typography.title, color: t.colors.text },
    meta: { ...typography.caption, color: t.colors.textMuted },
    headerBtnText: {
      ...typography.caption,
      color: t.colors.text,
      fontWeight: '600',
    },
    sectionLabel: {
      ...typography.subtitle,
      color: t.colors.text,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    empty: {
      ...typography.body,
      color: t.colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.md,
    },
  })
);

export function GroupDetailScreen() {
  const route = useRoute<DetailRoute>();
  const navigation = useNavigation<Nav>();
  const styles = useStyles();
  const { groupId } = route.params;
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.getCurrentUserId());
  const groups = useGroupsStore((s) => s.groups);
  const memberships = useGroupsStore((s) => s.groupMemberships);
  const matches = useMatchesStore((s) => s.matches);
  const ratingsSubmittedByMatchId = useMatchesStore((s) => s.matchRatingsSubmissionByMatchId);
  const { configured, loading } = useSupabaseAuth();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('GroupSettings', { groupId })}
          hitSlop={8}
          testID="groups:detail:settings"
          accessibilityLabel="Grup Ayarları"
          accessibilityRole="button"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Text style={styles.headerBtnText}>Grup Ayarları</Text>
        </Pressable>
      ),
    });
  }, [navigation, groupId]);

  const group = groups.find((item) => item.id === groupId);
  const isOwner = group?.ownerId === userId;
  const isMember = memberships.some((item) => item.groupId === groupId && item.playerId === userId);
  const memberCount = memberships.filter((item) => item.groupId === groupId).length;

  const groupMatches = useMemo(
    () => matches.filter((item) => item.groupId === groupId && item.status !== 'cancelled'),
    [matches, groupId],
  );

  const showInitialSkeleton = configured && loading && !group;

  if (showInitialSkeleton) {
    return (
      <View style={styles.screen}>
        <View style={styles.listContent}>
          <SkeletonText variant="title" width="55%" />
          <SkeletonText variant="caption" width="24%" />
          <SettingsSectionSkeleton rows={2} />
          <SkeletonText variant="subtitle" width={96} />
          <SkeletonList count={2} renderItem={() => <MatchCardSkeleton />} />
        </View>
      </View>
    );
  }

  if (!group || !isMember) {
    return (
      <View style={styles.screen}>
        <View style={styles.deniedWrap}>
          <Text style={styles.title}>Bu grubu görüntüleme yetkin yok.</Text>
          <Text style={styles.meta}>
            Grup dışı katılımcıysan maç detayından kadroyu görebilirsin.
          </Text>
        </View>
      </View>
    );
  }

  const listHeader = (
    <View style={styles.listHeader}>
      <View style={styles.titleBlock}>
        <Text style={styles.title} accessibilityRole="header">
          {group.name}
        </Text>
        <Text style={styles.meta}>
          {memberCount} üye
        </Text>
      </View>

      <PillButton
        title="Liderlik Tablosu"
        variant="ghost"
        onPress={() => navigation.navigate('GroupLeaderboard', { groupId })}
        testID="groups:leaderboard:open"
        accessibilityLabel="Liderlik tablosunu aç"
      />
      {isOwner ? (
        <PillButton
          title="Haftalık maç tekrarı"
          variant="ghost"
          onPress={() => navigation.navigate('GroupWeeklySeries', { groupId })}
          testID="groups:weekly:open"
          accessibilityLabel="Haftalık maç tekrarını aç"
        />
      ) : null}

      <Text style={styles.sectionLabel}>Maçlar</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={groupMatches}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: getTabBarListPaddingBottom(insets.bottom) },
        ]}
        ListEmptyComponent={
          <Text style={styles.empty}>Bu grupta henüz planlanan maç yok.</Text>
        }
        renderItem={({ item }) => (
          <MatchCardListRow matchId={item.id}>
            <MatchCard
              match={item}
              goingCount={countGoing(item)}
              userRsvp={
                item.attendees.find((att) => att.playerId === userId)?.status ?? null
              }
              onPress={() => {
                const dest = resolveMyMatchesEntryScreen(item, userId ?? '', ratingsSubmittedByMatchId);
                if (dest === 'MatchSummary') navigation.navigate('MatchSummary', { matchId: item.id });
                else if (dest === 'MatchRatingFlow') navigation.navigate('MatchRatingFlow', { matchId: item.id });
                else navigation.navigate('MatchDetail', { matchId: item.id });
              }}
            />
          </MatchCardListRow>
        )}
      />
    </View>
  );
}
