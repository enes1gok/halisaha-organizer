import * as Sharing from 'expo-sharing';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { MatchFinishedResultCard } from '../components/MatchFinishedResultCard';
import { MatchScoreLines } from '../components/MatchScoreLines';
import { PillButton } from '../components/PillButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { TAB_BAR_LIST_PADDING_BOTTOM } from '../navigation/tabBarLayout';
import type { GroupsStackParamList, HomeStackParamList, MyMatchesStackParamList } from '../navigation/types';
import { colors, letterSpacing, radius, shadows, spacing, typography } from '../theme';
import { computeBadgesEarnedInMatch } from '../domain/badges/computeBadgesEarnedInMatch';
import { useRatingWindow } from '../hooks/useRatingWindow';
import { countGoing } from '../utils/matchRoster';
import { isRemoteMatchId } from '../utils/matchId';
import { formatMatchDateTime } from '../utils/dates';
import { getMatchContribution } from '../utils/matchPlayerContribution';
import { getPlayerMatchOutcome } from '../utils/matchOutcome';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore, useMatchesStore, usePlayersStore } from '../store';
import { useUserFeedback } from '../utils/userFeedback';

type Stacks = HomeStackParamList & MyMatchesStackParamList & GroupsStackParamList;
type R =
  | RouteProp<HomeStackParamList, 'MatchSummary'>
  | RouteProp<MyMatchesStackParamList, 'MatchSummary'>
  | RouteProp<GroupsStackParamList, 'MatchSummary'>;
type Nav = NativeStackNavigationProp<Stacks>;

export function MatchFinalScreen() {
  const route = useRoute<R>();
  const navigation = useNavigation<Nav>();
  const { matchId } = route.params;
  const { showToast } = useUserFeedback();

  const cardRef = useRef<View>(null);
  const [shareBusy, setShareBusy] = useState(false);

  const userId = useAuthStore((s) => s.getCurrentUserId());
  const getPlayer = usePlayersStore((s) => s.getPlayer);
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

  const ratingWindow = useRatingWindow(match?.ratingWindowEndsAt ?? ratingSummary?.rating_window_ends_at);

  const onShareCardImage = useCallback(async () => {
    const shareSummaryText = [
      match?.venue ?? '',
      match ? formatMatchDateTime(match.startsAt) : '',
      match?.result ? `Skor: ${match.result.scoreA} – ${match.result.scoreB}` : 'Sonuç yok',
    ].join('\n');

    if (!match || !cardRef.current) {
      try { await Share.share({ message: shareSummaryText }); } catch { /* ignore */ }
      return;
    }
    setShareBusy(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 0.95, result: 'tmpfile' });
      const available = await Sharing.isAvailableAsync();
      if (available && uri) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Maç kartını paylaş' });
      } else {
        await Share.share({ message: shareSummaryText });
      }
    } catch {
      try { await Share.share({ message: match ? [match.venue, formatMatchDateTime(match.startsAt)].join('\n') : '' }); }
      catch { showToast({ title: 'Hata', message: 'Paylaşılamadı.', variant: 'error' }); }
    } finally {
      setShareBusy(false);
    }
  }, [match, showToast]);

  if (!match) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyMsg}>Maç bulunamadı</Text>
      </View>
    );
  }

  const goingCount = countGoing(match);
  const onLineup = match.teamAIds.includes(userId) || match.teamBIds.includes(userId);

  const myAvg =
    onLineup && ratingSummary?.players?.length
      ? ratingSummary.players.find((p) => p.player_id === userId)?.avg ?? null
      : null;

  // Pencere durumu
  const windowClosed =
    ratingWindow.isClosed || (ratingSummary?.rating_window_closed ?? false);
  const windowEndsAt = match.ratingWindowEndsAt ?? ratingSummary?.rating_window_ends_at ?? null;

  // MOTM winner
  const motmWinner = useMemo(() => {
    const motm = ratingSummary?.motm ?? [];
    if (!motm.length) return null;
    const maxVotes = motm[0]?.votes ?? 0;
    if (maxVotes <= 0) return null;
    const winner = motm.find((m) => m.votes === maxVotes);
    return winner ? getPlayer(winner.player_id) : null;
  }, [ratingSummary, getPlayer]);

  // Badge'ler (bu maçta kazanılan)
  const newBadges = useMemo(() => {
    const me = getPlayer(userId);
    if (!me || !onLineup || !match.result) return [];
    const inputs = {
      careerGoals: me.stats.goals,
      careerAssists: me.stats.assists,
      finishedMatchesPlayed: me.stats.matchesPlayed,
      wins: me.stats.wins,
      draws: me.stats.draws,
      losses: me.stats.losses,
      motmCount: me.stats.motmCount ?? 0,
      goalMatchStreakCurrent: 0,
      goalMatchStreakBest: 0,
      avgPeerRating100: me.stats.ratingAverage100 ?? null,
      peerRatingVoteCount: me.stats.ratingVoteCount ?? 0,
      maxGoalsSingleMatch: 0,
      maxAssistsSingleMatch: 0,
    };
    const { goals, assists } = getMatchContribution(match, userId);
    const outcome = getPlayerMatchOutcome(match, userId);
    return computeBadgesEarnedInMatch(inputs, {
      goals,
      assists,
      wonMotm: motmWinner?.id === userId,
      played: true,
      won: outcome === 'W',
    });
  }, [match, userId, getPlayer, onLineup, motmWinner]);

  const showRatingCta = onLineup && !hasSubmittedRatings && isRemoteMatchId(match.id) && !windowClosed;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: TAB_BAR_LIST_PADDING_BOTTOM }}>
      <View style={styles.pad}>
        <MatchFinishedResultCard
          ref={cardRef}
          match={match}
          getPlayer={getPlayer}
          myRatingAvg={onLineup && myAvg != null ? myAvg : null}
        />

        <PillButton
          title={shareBusy ? 'Hazırlanıyor…' : 'Görseli paylaş'}
          variant="ghost"
          onPress={() => void onShareCardImage()}
          disabled={shareBusy}
          testID="summary:share-image:press"
        />

        {/* Katılımcı sayısı */}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Katılımcı</Text>
          <Text style={styles.infoValue}>Rezerve {goingCount}/{match.maxPlayers}</Text>
        </View>

        {/* Gol / asist satırları */}
        {match.result ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Goller & Asistler</Text>
            <MatchScoreLines match={match} getPlayer={getPlayer} />
          </View>
        ) : null}

        {/* Pencere açık: puan ver CTA */}
        {showRatingCta ? (
          <View style={styles.section}>
            {windowEndsAt ? (
              <Text style={styles.hint}>
                {ratingWindow.isOpen && ratingWindow.secondsLeft != null
                  ? `Puanlama penceresi ${Math.ceil(ratingWindow.secondsLeft / 60)} dakika sonra kapanıyor.`
                  : 'Puanlama yapabilirsin.'}
              </Text>
            ) : null}
            <PillButton
              title="Oyuncuları derecelendir"
              onPress={() => navigation.navigate('MatchRatingFlow', { matchId })}
              testID="final:goto-ratings"
            />
          </View>
        ) : null}

        {/* Puanlama kapandı: MOTM + averages */}
        {windowClosed && ratingSummary ? (
          <>
            {motmWinner ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Maçın Adamı</Text>
                <View style={styles.motmRow}>
                  <PlayerAvatar name={motmWinner.name} uri={motmWinner.photoUri} size={48} />
                  <View>
                    <Text style={styles.motmName}>{motmWinner.name}</Text>
                    <Text style={styles.motmBadge}>⭐ Maçın Adamı</Text>
                  </View>
                </View>
              </View>
            ) : null}

            {ratingSummary.players.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Oyuncu Puanları</Text>
                {ratingSummary.players
                  .filter((p) => (p.votes_count ?? 0) > 0)
                  .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
                  .map((p) => {
                    const pl = getPlayer(p.player_id);
                    if (!pl) return null;
                    return (
                      <View key={p.player_id} style={styles.playerRow}>
                        <PlayerAvatar name={pl.name} uri={pl.photoUri} size={32} />
                        <Text style={styles.playerName}>{pl.name}</Text>
                        <Text style={styles.playerAvg}>
                          {p.avg != null ? p.avg.toFixed(1) : '—'}
                        </Text>
                      </View>
                    );
                  })}
              </View>
            ) : null}

            {newBadges.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Bu Maçta Kazanılan Rozetler</Text>
                <View style={styles.badgesRow}>
                  {newBadges.map((b) => (
                    <View key={b.id} style={styles.badgeChip}>
                      <Text style={styles.badgeTitle}>{b.title}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {/* Pencere kapandı ama summary henüz yok / bekleniyor */}
        {!windowClosed && hasSubmittedRatings && windowEndsAt ? (
          <View style={[styles.section, styles.waitingCard]}>
            <Text style={styles.waitingTitle}>Sonuçlar bekleniyor</Text>
            <Text style={styles.hint}>
              {ratingWindow.isOpen && ratingWindow.secondsLeft != null
                ? `Tüm sonuçlar ${formatMatchDateTime(windowEndsAt)} sonra açıklanacak.`
                : 'Sonuçlar açıklanıyor…'}
            </Text>
          </View>
        ) : null}

        <PillButton
          title="Tüm maç bilgisi"
          variant="ghost"
          onPress={() => navigation.navigate('MatchDetail', { matchId })}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  pad: { padding: spacing.md, gap: spacing.sm },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMsg: { color: colors.textMuted },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.sm,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.normal,
  },
  infoValue: { ...typography.subtitle, color: colors.accent, marginTop: spacing.xs },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.sm,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.wide,
  },
  hint: { ...typography.caption, color: colors.textMuted },
  motmRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  motmName: { ...typography.subtitle, color: colors.text },
  motmBadge: { ...typography.caption, color: colors.accent },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  playerName: { ...typography.body, color: colors.text, flex: 1 },
  playerAvg: { ...typography.subtitle, color: colors.accent },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badgeChip: {
    backgroundColor: colors.accentMuted,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeTitle: { ...typography.caption, color: colors.accent, fontWeight: '700' },
  waitingCard: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  waitingTitle: { ...typography.subtitle, color: colors.accent },
});
