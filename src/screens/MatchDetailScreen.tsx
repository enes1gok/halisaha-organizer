import * as Clipboard from 'expo-clipboard';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  LayoutAnimation,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { PressableScale } from '../components/PressableScale';
import { RsvpGoingButton } from '../components/RsvpGoingButton';
import { useTheme } from '../theme/ThemeContext';
import type { RSVPStatus } from '../types/domain';
import { useClipboardCopyFeedback } from '../hooks/useClipboardCopyFeedback';
import { useCountdown } from '../hooks/useCountdown';
import { useMatchPostMatchWindow } from '../hooks/useMatchPostMatchWindow';
import { fetchMyMotmPickForMatch, fetchMyPeerRatingsForMatch } from '../services/supabase/matchRatings';
import { toUserMessage } from '../services/supabase/errors';
import { TAB_BAR_LIST_PADDING_BOTTOM } from '../navigation/tabBarLayout';
import type { GroupsStackParamList, HomeStackParamList, MyMatchesStackParamList } from '../navigation/types';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore, useMatchesStore, usePlayersStore } from '../store';
import { sortAttendeesWithPlayers } from '../store/helpers';
import { isRemoteMatchId } from '../utils/matchId';
import { canRespondToSelfReportRequest } from '../utils/selfReportPeerReview';
import { MatchDetailHero } from './MatchDetail/components/MatchDetailHero';
import { MatchDetailPaymentPanel } from './MatchDetail/components/MatchDetailPaymentPanel';
import { MatchDetailRosterPanel } from './MatchDetail/components/MatchDetailRosterPanel';
import { MatchDetailSegmentControl } from './MatchDetail/components/MatchDetailSegmentControl';
import { MatchDetailSummaryPanel } from './MatchDetail/components/MatchDetailSummaryPanel';
import { useMatchDetailStyles } from './MatchDetail/matchDetailStyles';
import type { MatchDetailTab } from './MatchDetail/types';

type MatchStacks = HomeStackParamList & MyMatchesStackParamList & GroupsStackParamList;
type MatchDetailRoute =
  | RouteProp<HomeStackParamList, 'MatchDetail'>
  | RouteProp<MyMatchesStackParamList, 'MatchDetail'>
  | RouteProp<GroupsStackParamList, 'MatchDetail'>;
type Nav = NativeStackNavigationProp<MatchStacks>;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const REMOTE_DETAIL_REFRESH_MS = 45_000;

export function MatchDetailScreen() {
  const route = useRoute<MatchDetailRoute>();
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const matchDetailStyles = useMatchDetailStyles();
  const { matchId } = route.params;

  const userId = useAuthStore((s) => s.getCurrentUserId());
  const getPlayer = usePlayersStore((s) => s.getPlayer);
  const {
    setRSVP,
    setPaid,
    setSelfReportEnabled,
    addSelfReport,
    respondSelfReport,
    refreshRemoteMatch,
    loadMatchRatingSummary,
    unlockLineup,
    cancelMatch,
    match,
    ratingSummary,
  } = useMatchesStore(
    useShallow((s) => ({
      setRSVP: s.setRSVP,
      setPaid: s.setPaid,
      setSelfReportEnabled: s.setSelfReportEnabled,
      addSelfReport: s.addSelfReport,
      respondSelfReport: s.respondSelfReport,
      refreshRemoteMatch: s.refreshRemoteMatch,
      loadMatchRatingSummary: s.loadMatchRatingSummary,
      unlockLineup: s.unlockLineup,
      cancelMatch: s.cancelMatch,
      match: s.getMatch(matchId),
      ratingSummary: s.matchRatingSummariesById[matchId],
    })),
  );

  const [ratingHints, setRatingHints] = useState({ peer: false, motm: false });
  const [tab, setTab] = useState<MatchDetailTab>('summary');
  const [paidConfirm, setPaidConfirm] = useState<{
    playerId: string;
    playerName: string;
    nextPaid: boolean;
  } | null>(null);

  const rsvpRef = useRef<BottomSheetModal>(null);
  const lastRemoteDetailRefreshMs = useRef(0);
  const snapPoints = useMemo(() => ['40%'], []);
  const [refreshing, setRefreshing] = useState(false);
  const [rsvpGoingKey, setRsvpGoingKey] = useState(0);
  const [cancelConfirmVisible, setCancelConfirmVisible] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const countdown = useCountdown(match?.startsAt ?? new Date().toISOString());
  const { pastScheduledEnd, endsAtIso } = useMatchPostMatchWindow(match?.startsAt);

  const organizer = match ? getPlayer(match.organizerId) : undefined;
  const isOrganizer = match?.organizerId === userId;
  const userOnMatchLineup = Boolean(
    match && (match.teamAIds.includes(userId) || match.teamBIds.includes(userId)),
  );

  const rosterSize = useMemo(
    () => (match ? new Set([...match.teamAIds, ...match.teamBIds]).size : 0),
    [match?.teamAIds, match?.teamBIds],
  );

  const showFinishedRatingsChrome = Boolean(
    match && match.status === 'finished' && isRemoteMatchId(match.id) && rosterSize > 0,
  );

  const motmWinnerIds = useMemo(() => {
    const ranks = ratingSummary?.motm ?? [];
    if (!ranks.length) return new Set<string>();
    const max = ranks[0]?.votes ?? 0;
    if (max <= 0) return new Set<string>();
    return new Set(ranks.filter((x) => x.votes === max).map((x) => x.player_id));
  }, [ratingSummary]);

  const ratingByPid = useMemo(() => {
    const m = new Map<string, { avg: number | null; votes_count: number }>();
    for (const row of ratingSummary?.players ?? []) {
      m.set(row.player_id, { avg: row.avg, votes_count: row.votes_count });
    }
    return m;
  }, [ratingSummary]);

  useFocusEffect(
    useCallback(() => {
      if (!match || match.status !== 'finished' || !isRemoteMatchId(match.id) || rosterSize === 0) {
        return undefined;
      }
      void loadMatchRatingSummary(match.id);
      if (!userOnMatchLineup) {
        setRatingHints({ peer: false, motm: false });
        return undefined;
      }

      let cancelled = false;
      void (async () => {
        try {
          const [scores, motm] = await Promise.all([
            fetchMyPeerRatingsForMatch(match.id),
            fetchMyMotmPickForMatch(match.id),
          ]);
          if (!cancelled) {
            setRatingHints({ peer: scores.length > 0, motm: Boolean(motm) });
          }
        } catch {
          /* pull-to-refresh veya yeniden odak için sessiz geç */
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [match, rosterSize, userOnMatchLineup, loadMatchRatingSummary]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!isRemoteMatchId(matchId)) return undefined;
      const now = Date.now();
      if (now - lastRemoteDetailRefreshMs.current < REMOTE_DETAIL_REFRESH_MS) return undefined;
      lastRemoteDetailRefreshMs.current = now;
      void refreshRemoteMatch(matchId).catch(() => {
        /* odak yenilemesi — kullanıcıya toast yok; pull-to-refresh ile tekrar denenebilir */
      });
      return undefined;
    }, [matchId, refreshRemoteMatch]),
  );

  const { label: joinCopyLabel, runCopy: runJoinCopy, isCopied: joinCopied } = useClipboardCopyFeedback({
    idleLabel: 'Kodu Kopyala',
  });
  const { label: ibanCopyLabel, runCopy: runIbanCopy, isCopied: ibanCopied } = useClipboardCopyFeedback({
    idleLabel: 'IBAN Kopyala',
  });

  const attendeesSorted = useMemo(() => {
    if (!match) return [];
    return sortAttendeesWithPlayers(match.attendees, getPlayer);
  }, [match, getPlayer]);

  const onPressCopyJoin = useCallback(() => {
    if (!match) return;
    runJoinCopy(async () => {
      await Clipboard.setStringAsync(match.joinCode);
    });
  }, [match, runJoinCopy]);

  const onPressCopyIban = useCallback(() => {
    const iban = match?.iban;
    if (!iban) return;
    runIbanCopy(async () => {
      await Clipboard.setStringAsync(iban.replace(/\s/g, ''));
    });
  }, [match?.iban, runIbanCopy]);

  const onUnlockLineup = useCallback(() => {
    if (!match) return;
    Alert.alert(
      'Kilidi kaldır?',
      'Oyunculara bildirim gitmiş olabilir. Kadroyu yeniden düzenleyebilirsiniz; yeniden yayınladığınızda bildirim yeniden tetiklenebilir.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Kaldır',
          style: 'destructive',
          onPress: () =>
            void unlockLineup(match.id).catch((err) =>
              Alert.alert('Hata', toUserMessage(err, 'Kaydedilemedi.')),
            ),
        },
      ],
    );
  }, [match, unlockLineup]);

  const openCancelConfirm = useCallback(() => {
    setCancelConfirmVisible(true);
  }, []);

  const closeCancelConfirm = useCallback(() => {
    if (cancelling) return;
    setCancelConfirmVisible(false);
  }, [cancelling]);

  const onConfirmCancel = useCallback(async () => {
    if (!match || cancelling) return;
    setCancelling(true);
    try {
      await cancelMatch(match.id);
      setCancelConfirmVisible(false);
    } catch (err) {
      Alert.alert('Hata', toUserMessage(err, 'Maç iptal edilemedi.'));
    } finally {
      setCancelling(false);
    }
  }, [match, cancelMatch, cancelling]);

  const openRsvp = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRsvpGoingKey((k) => k + 1);
    rsvpRef.current?.present();
  };

  const applyRsvp = async (status: RSVPStatus) => {
    if (!match) return;
    try {
      await setRSVP(match.id, userId, status);
      rsvpRef.current?.dismiss();
    } catch (e) {
      Alert.alert('Hata', toUserMessage(e, 'Kaydedilemedi.'));
    }
  };

  const handlePressEditPaid = useCallback((playerId: string, playerName: string, nextPaid: boolean) => {
    setPaidConfirm({ playerId, playerName, nextPaid });
  }, []);

  const closePaidConfirm = useCallback(() => {
    setPaidConfirm(null);
  }, []);

  const onConfirmPaidChange = useCallback(() => {
    if (!paidConfirm || !match || !userId) return;
    const { playerId, nextPaid } = paidConfirm;
    setPaidConfirm(null);
    void setPaid(match.id, playerId, nextPaid, userId).catch((err) =>
      Alert.alert('Hata', toUserMessage(err, 'Kaydedilemedi.')),
    );
  }, [paidConfirm, match, userId, setPaid]);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    [],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshRemoteMatch(matchId);
      if (showFinishedRatingsChrome) {
        void loadMatchRatingSummary(matchId);
      }
    } catch (e) {
      Alert.alert('Hata', toUserMessage(e, 'Yenilenemedi.'));
    } finally {
      setRefreshing(false);
    }
  };

  if (!match) {
    return (
      <View style={matchDetailStyles.center}>
        <Text style={matchDetailStyles.emptyText}>Maç bulunamadı.</Text>
      </View>
    );
  }

  const showPrice = (match.pricePerPerson ?? 0) > 0;
  const showIbanPayment = match.paymentMethod === 'iban' && Boolean(match.iban);
  const showCashPayment = match.paymentMethod === 'cash';
  const showNoteOnlyPayment = match.paymentMethod === 'note_only';

  const actionablePending = useMemo(() => {
    if (!userId) return [];
    return match.selfReports.filter(
      (r) =>
        r.status === 'pending' && canRespondToSelfReportRequest(match, r.playerId, userId),
    );
  }, [match, userId]);

  const paidConfirmMessage =
    paidConfirm &&
    `${paidConfirm.playerName} için ödeme durumu “${paidConfirm.nextPaid ? 'Ödendi' : 'Ödenmedi'}” olarak kaydedilsin mi?`;

  return (
    <View style={matchDetailStyles.screen}>
      <MatchDetailHero match={match} countdownLabel={countdown} />
      <View style={matchDetailStyles.segmentWrap}>
        <MatchDetailSegmentControl value={tab} onChange={setTab} />
      </View>

      <ScrollView
        style={styles.tabScroll}
        contentContainerStyle={[styles.tabScrollContent, { paddingBottom: TAB_BAR_LIST_PADDING_BOTTOM }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {tab === 'summary' ? (
          <MatchDetailSummaryPanel
            match={match}
            navigation={navigation}
            organizerName={organizer?.name ?? '—'}
            joinCopyLabel={joinCopyLabel}
            joinCopied={joinCopied}
            onPressCopyJoin={onPressCopyJoin}
            isOrganizer={isOrganizer}
            userOnMatchLineup={userOnMatchLineup}
            showFinishedRatingsChrome={showFinishedRatingsChrome}
            ratingHints={ratingHints}
            actionablePending={actionablePending}
            getPlayer={getPlayer}
            onRespondSelfReport={(reportId, approved) =>
              void respondSelfReport(match.id, reportId, approved).catch((err) =>
                Alert.alert('Hata', toUserMessage(err, 'Kaydedilemedi.')),
              )
            }
            openRsvp={openRsvp}
            onAddSelfReport={(kind) => {
              if (!userId) return;
              void addSelfReport(match.id, userId, kind).catch((err) =>
                Alert.alert('Hata', toUserMessage(err, 'Kaydedilemedi.')),
              );
            }}
            pastScheduledEnd={pastScheduledEnd}
            endsAtIso={endsAtIso}
            onUnlockLineup={onUnlockLineup}
            openCancelConfirm={openCancelConfirm}
            onSetSelfReportEnabled={(v) =>
              void setSelfReportEnabled(match.id, v).catch((err) =>
                Alert.alert('Hata', toUserMessage(err, 'Kaydedilemedi.')),
              )
            }
          />
        ) : null}

        {tab === 'roster' ? (
          <MatchDetailRosterPanel
            match={match}
            attendeesSorted={attendeesSorted}
            motmWinnerIds={motmWinnerIds}
            ratingByPid={ratingByPid}
          />
        ) : null}

        {tab === 'payment' ? (
          <MatchDetailPaymentPanel
            match={match}
            showPrice={showPrice}
            showIbanPayment={showIbanPayment}
            showCashPayment={showCashPayment}
            showNoteOnlyPayment={showNoteOnlyPayment}
            ibanCopyLabel={ibanCopyLabel}
            ibanCopied={ibanCopied}
            onPressCopyIban={onPressCopyIban}
            attendeesSorted={attendeesSorted}
            isOrganizer={isOrganizer}
            userId={userId}
            onPressEditPaid={handlePressEditPaid}
          />
        ) : null}
      </ScrollView>

      <BottomSheetModal
        ref={rsvpRef}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={matchDetailStyles.sheetBg}
        handleIndicatorStyle={matchDetailStyles.handle}
      >
        <BottomSheetView style={matchDetailStyles.rsvpBody}>
          <Text style={matchDetailStyles.sheetTitle}>Katılım</Text>
          <RsvpGoingButton
            key={rsvpGoingKey}
            onCommit={() => setRSVP(match.id, userId, 'going')}
            onSuccess={() => rsvpRef.current?.dismiss()}
            onError={(e) => Alert.alert('Hata', toUserMessage(e, 'Kaydedilemedi.'))}
            testID="match:rsvp-going:press"
          />
          <PressableScale
            onPress={() => applyRsvp('maybe')}
            style={matchDetailStyles.rsvpSecondaryRow}
            pressedScale={0.98}
            testID="match:rsvp:maybe:press"
            accessibilityLabel="Belki"
          >
            <Ionicons name="help-circle" size={22} color={colors.accent} />
            <Text style={matchDetailStyles.rsvpSecondaryLabel}>Belki</Text>
          </PressableScale>
          <PressableScale
            onPress={() => applyRsvp('notGoing')}
            style={matchDetailStyles.rsvpSecondaryRow}
            pressedScale={0.98}
            testID="match:rsvp:not-going:press"
            accessibilityLabel="Gelmiyorum"
          >
            <Ionicons name="close-circle" size={22} color={colors.danger} />
            <Text style={matchDetailStyles.rsvpSecondaryLabel}>Gelmiyorum</Text>
          </PressableScale>
        </BottomSheetView>
      </BottomSheetModal>

      <ConfirmationModal
        visible={cancelConfirmVisible}
        title="Maçı iptal et?"
        message="Bu maç iptal edilecek ve 'katılıyorum' diyen oyunculara bildirim gönderilecek. Bu işlem geri alınamaz."
        confirmLabel={cancelling ? 'İptal ediliyor…' : 'İptal Et'}
        cancelLabel="Vazgeç"
        onCancel={closeCancelConfirm}
        onConfirm={() => {
          void onConfirmCancel();
        }}
        danger
      />

      <ConfirmationModal
        visible={paidConfirm !== null}
        title="Ödeme durumu"
        message={paidConfirmMessage ?? ''}
        confirmLabel="Kaydet"
        cancelLabel="Vazgeç"
        onCancel={closePaidConfirm}
        onConfirm={onConfirmPaidChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabScroll: {
    flex: 1,
  },
  tabScrollContent: {
    flexGrow: 1,
  },
});
