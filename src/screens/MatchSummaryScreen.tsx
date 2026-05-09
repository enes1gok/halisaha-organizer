import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PillButton } from '../components/PillButton';
import { TAB_BAR_LIST_PADDING_BOTTOM } from '../navigation/tabBarLayout';
import type { GroupsStackParamList, HomeStackParamList, MyMatchesStackParamList } from '../navigation/types';
import { colors, letterSpacing, spacing, typography } from '../theme';
import { countGoing } from '../utils/matchRoster';
import { useMatchPostMatchWindow } from '../hooks/useMatchPostMatchWindow';
import { formatMatchDateTime } from '../utils/dates';
import { isRemoteMatchId } from '../utils/matchId';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore, useMatchesStore } from '../store';

type Stacks = HomeStackParamList & MyMatchesStackParamList & GroupsStackParamList;
type R =
  | RouteProp<HomeStackParamList, 'MatchSummary'>
  | RouteProp<MyMatchesStackParamList, 'MatchSummary'>
  | RouteProp<GroupsStackParamList, 'MatchSummary'>;
type Nav = NativeStackNavigationProp<Stacks>;

export function MatchSummaryScreen() {
  const route = useRoute<R>();
  const navigation = useNavigation<Nav>();
  const { matchId } = route.params;

  const userId = useAuthStore((s) => s.getCurrentUserId());
  const { match, hasSubmittedRatings, loadSummary, ratingSummary } = useMatchesStore(
    useShallow((s) => ({
      match: s.getMatch(matchId),
      hasSubmittedRatings: !!s.matchRatingsSubmissionByMatchId[matchId],
      loadSummary: s.loadMatchRatingSummary,
      ratingSummary: s.matchRatingSummariesById[matchId],
    })),
  );

  React.useEffect(() => {
    if (
      match?.status === 'finished' &&
      isRemoteMatchId(match.id) &&
      new Set([...match.teamAIds, ...match.teamBIds]).size > 0
    ) {
      void loadSummary(match.id);
    }
  }, [match?.id, match?.status, loadSummary]);

  if (!match) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textMuted }}>Maç bulunamadı</Text>
      </View>
    );
  }

  const goingCount = countGoing(match);
  const lineup = match.teamAIds.includes(userId) || match.teamBIds.includes(userId);

  const myAvg =
    lineup && ratingSummary?.players?.length
      ? ratingSummary.players.find((p) => p.player_id === userId)?.avg ?? null
      : null;

  const showRatingReminder = lineup && match.result && !hasSubmittedRatings && isRemoteMatchId(match.id);
  const { pastScheduledEnd, endsAtIso } = useMatchPostMatchWindow(match.startsAt);
  const postgameNavBlocked = !showRatingReminder && !pastScheduledEnd;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: TAB_BAR_LIST_PADDING_BOTTOM }}>
      <View style={styles.pad}>
        <MatchCardStatic>
          <Text style={[typography.subtitle, styles.venue]} numberOfLines={2}>
            {match.venue}
          </Text>
          <Text style={[typography.caption, styles.date]}>{formatMatchDateTime(match.startsAt)}</Text>
          <Text style={[typography.body, styles.resultLine]}>
            {match.result ? `Skor: ${match.result.scoreA} – ${match.result.scoreB}` : 'Sonuç yok'}
          </Text>
          {lineup && myAvg != null ? (
            <Text style={styles.miniAvg}>Oy ortalamanız: {myAvg.toFixed(1)} / 100</Text>
          ) : null}
        </MatchCardStatic>

        <View style={styles.listCard}>
          <Text style={[typography.caption, styles.muted]}>Katılımcı</Text>
          <Text style={styles.goingLbl}>
            Rezerve {goingCount}/{match.maxPlayers}
          </Text>
        </View>

        {showRatingReminder ? (
          <Text style={[styles.banner, styles.mt]}>
            Oyuncuları derecelendirme yapmadınız — maç sonrası ekranından devam edin.
          </Text>
        ) : null}

        <PillButton
          title={showRatingReminder ? 'Oyuncuları derecelendir' : 'Maç sonrası'}
          onPress={() =>
            showRatingReminder
              ? navigation.navigate('MatchRatings', { matchId })
              : navigation.navigate('MatchPostgame', { matchId })
          }
          variant={showRatingReminder ? undefined : 'ghost'}
          style={styles.mt}
          disabled={postgameNavBlocked}
          accessibilityState={{ disabled: postgameNavBlocked }}
          testID="summary:goto-postgame"
        />
        {postgameNavBlocked ? (
          <Text style={styles.hintMuted}>
            Maç sonrası, tahmini bitişten sonra açılır ({formatMatchDateTime(endsAtIso)}).
          </Text>
        ) : null}

        <PillButton title="Tüm maç bilgisi" variant="ghost" onPress={() => navigation.navigate('MatchDetail', { matchId })} />
      </View>
    </ScrollView>
  );
}

/** MatchCard ile aynı kutu stili ama liste gibi dokunmatik kapalı */
function MatchCardStatic({ children }: { children: React.ReactNode }) {
  return (
    <View style={cardStyles.wrap}>
      <View style={cardStyles.row}>{children}</View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  row: {
    gap: spacing.xs,
  },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  pad: { padding: spacing.md, gap: spacing.sm },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  venue: { color: colors.text },
  date: { color: colors.textMuted },
  goingLbl: { ...typography.subtitle, color: colors.accent, marginTop: spacing.xs },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  muted: { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: letterSpacing.normal },
  resultLine: { color: colors.text, marginTop: spacing.sm },
  miniAvg: { ...typography.caption, color: colors.accent, marginTop: spacing.xs },
  banner: { ...typography.caption, color: colors.accent },
  hintMuted: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  mt: { marginTop: spacing.sm },
});
