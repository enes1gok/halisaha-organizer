import * as Sharing from 'expo-sharing';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { MatchFinishedResultCard } from '../components/MatchFinishedResultCard';
import { PillButton } from '../components/PillButton';
import { TAB_BAR_LIST_PADDING_BOTTOM } from '../navigation/tabBarLayout';
import type { GroupsStackParamList, HomeStackParamList, MyMatchesStackParamList } from '../navigation/types';
import { colors, letterSpacing, shadows, spacing, typography } from '../theme';
import { countGoing } from '../utils/matchRoster';
import { useMatchPostMatchWindow } from '../hooks/useMatchPostMatchWindow';
import { formatMatchDateTime } from '../utils/dates';
import { isRemoteMatchId } from '../utils/matchId';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore, useMatchesStore, usePlayersStore } from '../store';

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

  const shareSummaryText = useMemo(() => {
    if (!match) return '';
    const lines = [match.venue, formatMatchDateTime(match.startsAt)];
    if (match.result) {
      lines.push(`Skor: ${match.result.scoreA} – ${match.result.scoreB}`);
    } else {
      lines.push('Sonuç yok');
    }
    return lines.join('\n');
  }, [match]);

  const onShareCardImage = useCallback(async () => {
    if (!match || !cardRef.current) {
      try {
        await Share.share({ message: shareSummaryText });
      } catch {
        Alert.alert('Hata', 'Paylaşılamadı.');
      }
      return;
    }
    setShareBusy(true);
    try {
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 0.95,
        result: 'tmpfile',
      });
      const available = await Sharing.isAvailableAsync();
      if (available && uri) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Maç kartını paylaş',
        });
      } else {
        await Share.share({ message: shareSummaryText });
      }
    } catch {
      try {
        await Share.share({ message: shareSummaryText });
      } catch {
        Alert.alert('Hata', 'Paylaşılamadı.');
      }
    } finally {
      setShareBusy(false);
    }
  }, [match, shareSummaryText]);

  if (!match) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyMsg}>Maç bulunamadı</Text>
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
        <MatchFinishedResultCard
          ref={cardRef}
          match={match}
          getPlayer={getPlayer}
          myRatingAvg={lineup && myAvg != null ? myAvg : null}
        />

        <PillButton
          title={shareBusy ? 'Hazırlanıyor…' : 'Görseli paylaş'}
          variant="ghost"
          onPress={() => void onShareCardImage()}
          disabled={shareBusy}
          testID="summary:share-image:press"
        />

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
  goingLbl: { ...typography.subtitle, color: colors.accent, marginTop: spacing.xs },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.sm,
  },
  muted: { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: letterSpacing.normal },
  banner: { ...typography.caption, color: colors.accent },
  hintMuted: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  mt: { marginTop: spacing.sm },
});
