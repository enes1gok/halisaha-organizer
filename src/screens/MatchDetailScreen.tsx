import * as Clipboard from 'expo-clipboard';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  UIManager,
  View,
} from 'react-native';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { MatchHeroVenueTitle } from '../components/MatchHeroVenueTitle';
import { PillButton } from '../components/PillButton';
import { RsvpGoingButton } from '../components/RsvpGoingButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { PositionBadge } from '../components/PositionBadge';
import { colors, letterSpacing, spacing, typography, radius } from '../theme';
import type { RSVPStatus } from '../types/domain';
import { maskIban } from '../utils/iban';
import { formatMatchDateTime } from '../utils/dates';
import { hasAssignedLineup } from '../utils/matchRoster';
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

  const rsvpRef = useRef<BottomSheetModal>(null);
  const lastRemoteDetailRefreshMs = useRef(0);
  const snapPoints = useMemo(() => ['32%'], []);
  const [refreshing, setRefreshing] = useState(false);
  const [rsvpGoingKey, setRsvpGoingKey] = useState(0);
  const [cancelConfirmVisible, setCancelConfirmVisible] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const countdown = useCountdown(match?.startsAt ?? new Date().toISOString());
  const { pastScheduledEnd, endsAtIso } = useMatchPostMatchWindow(match?.startsAt);

  const organizer = match ? getPlayer(match.organizerId) : undefined;
  const isOrganizer = match?.organizerId === userId;
  const userOnMatchLineup = Boolean(
    match &&
      (match.teamAIds.includes(userId) || match.teamBIds.includes(userId)),
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
      <View style={styles.center}>
        <Text style={styles.emptyText}>Maç bulunamadı.</Text>
      </View>
    );
  }

  const showPrice = (match.pricePerPerson ?? 0) > 0;
  const showIbanPayment = match.paymentMethod === 'iban' && Boolean(match.iban);
  const showCashPayment = match.paymentMethod === 'cash';
  const showNoteOnlyPayment = match.paymentMethod === 'note_only';

  const pending = match.selfReports.filter((r) => r.status === 'pending');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <View style={styles.hero}>
        <MatchHeroVenueTitle venue={match.venue} variant="detail" />
        <Text style={styles.heroDate}>{formatMatchDateTime(match.startsAt)}</Text>
        <Text style={[styles.heroCd, match.status === 'cancelled' && styles.heroCdCancelled]}>
          {match.status === 'upcoming'
            ? countdown
            : match.status === 'cancelled'
              ? 'Maç İptal Edildi'
              : 'Maç Bitti'}
        </Text>
        {match.status === 'cancelled' ? (
          <View style={styles.cancelBadge} accessibilityRole="text" accessibilityLabel="Maç iptal edildi">
            <Text style={styles.cancelBadgeTxt}>İPTAL EDİLDİ</Text>
          </View>
        ) : null}
        {match.status === 'finished' && match.result ? (
          <Text style={styles.heroScore}>
            Skor: {match.result.scoreA} – {match.result.scoreB}
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Organizatör</Text>
        <Text style={styles.body}>{organizer?.name ?? '—'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Katılım kodu</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.code}>{match.joinCode}</Text>
          <PillButton
            title={joinCopyLabel}
            variant="ghost"
            onPress={onPressCopyJoin}
            titleColor={joinCopied ? colors.copyFeedbackLight : undefined}
            accessibilityLabel={joinCopied ? 'Kopyalandı' : 'Katılım kodunu panoya kopyala'}
          />
        </View>
      </View>

      {isRemoteMatchId(match.id) && userOnMatchLineup && !isOrganizer ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saha</Text>
          <Text style={styles.muted}>Skoru girmek veya takım arkadaşlarını değerlendirmek için maç sonrası ekranını kullanın.</Text>
          <PillButton
            title="Maç sonrası"
            onPress={() => navigation.navigate('MatchPostgame', { matchId })}
            style={styles.mt}
            disabled={!pastScheduledEnd}
            accessibilityState={{ disabled: !pastScheduledEnd }}
            testID="match:detail:postgame:player"
          />
          {!pastScheduledEnd ? (
            <Text style={[styles.muted, styles.mtXs]}>
              Tahmini bitiş ({formatMatchDateTime(endsAtIso)}) sonrası açılır.
            </Text>
          ) : null}
        </View>
      ) : null}

      {showIbanPayment ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ödeme</Text>
          {showPrice ? <Text style={styles.muted}>Kişi başı ₺{match.pricePerPerson}</Text> : null}
          {match.ibanAccountName ? <Text style={styles.body}>{match.ibanAccountName}</Text> : null}
          <Text style={styles.iban}>{maskIban(match.iban ?? '')}</Text>
          <PillButton
            title={ibanCopyLabel}
            onPress={onPressCopyIban}
            style={styles.mt}
            titleColor={ibanCopied ? colors.copyFeedbackLight : undefined}
            accessibilityLabel={ibanCopied ? 'Kopyalandı' : 'IBAN\'ı panoya kopyala'}
          />
        </View>
      ) : null}
      {showCashPayment ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ödeme</Text>
          {showPrice ? <Text style={styles.muted}>Kişi başı ₺{match.pricePerPerson}</Text> : null}
          <Text style={styles.muted}>Ödeme nakit olarak sahada toplanacaktır.</Text>
        </View>
      ) : null}
      {showNoteOnlyPayment ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ödeme</Text>
          <Text style={styles.body}>{match.paymentNote ?? 'Not eklenmemiş.'}</Text>
        </View>
      ) : null}

      {isOrganizer && match.status !== 'cancelled' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yönetim</Text>
          <View style={styles.rowWrap}>
            {match.status === 'upcoming' && match.lineupLocked ? (
              <PillButton
                title="Kilidi kaldır"
                variant="secondary"
                onPress={onUnlockLineup}
                style={styles.flex}
                testID="match:lineup:unlock:press"
              />
            ) : null}
            {!match.lineupLocked && match.status === 'upcoming' ? (
              <PillButton
                title={hasAssignedLineup(match) ? 'Kadroyu düzenle' : 'Kadro Kur'}
                onPress={() => navigation.navigate('LineupBuilder', { matchId })}
                style={styles.flex}
                testID="match:lineup:builder:press"
              />
            ) : null}
            {match.status !== 'finished' ? (
              <>
                <PillButton
                  title="Maç sonrası"
                  onPress={() => navigation.navigate('MatchPostgame', { matchId })}
                  variant="ghost"
                  style={styles.flex}
                  disabled={!pastScheduledEnd}
                  accessibilityState={{ disabled: !pastScheduledEnd }}
                  testID="match:detail:postgame:organizer"
                />
                {!pastScheduledEnd ? (
                  <Text style={[styles.muted, styles.fullRow, styles.mtXs]}>
                    Tahmini bitiş ({formatMatchDateTime(endsAtIso)}) sonrası açılır.
                  </Text>
                ) : null}
              </>
            ) : null}
            {match.status === 'upcoming' ? (
              <PillButton
                title="Maçı İptal Et"
                variant="danger"
                onPress={openCancelConfirm}
                style={styles.fullRow}
                accessibilityLabel="Maçı iptal et"
                testID="match:cancel:press"
              />
            ) : null}
          </View>
          <View style={[styles.rowBetween, styles.mt]}>
            <Text style={styles.body}>Oyuncular kendi bildirsin</Text>
            <Switch
              value={match.selfReportEnabled}
              onValueChange={(v) =>
                void setSelfReportEnabled(match.id, v).catch((err) =>
                  Alert.alert('Hata', toUserMessage(err, 'Kaydedilemedi.')),
                )
              }
              trackColor={{ false: colors.border, true: colors.accentMuted }}
              thumbColor={match.selfReportEnabled ? colors.accent : colors.textMuted}
            />
          </View>
        </View>
      ) : null}

      {showFinishedRatingsChrome ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Derecelendirme</Text>
          <Text style={styles.muted}>
            Kadrodaki oyuncuların ortalama oyları listede gösterilir; bireysel oylar anonimdir. En çok seçilen maçın adamı
            vurgulanır.
          </Text>
          {userOnMatchLineup ? (
            <PillButton
              title={
                ratingHints.peer || ratingHints.motm ? 'Derecelendirmeyi düzenle' : 'Oyuncuları derecelendir'
              }
              onPress={() => navigation.navigate('MatchRatings', { matchId })}
              testID="match:ratings:cta:press"
              style={styles.mt}
            />
          ) : null}
        </View>
      ) : null}

      {isOrganizer && pending.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bekleyen bildirimler</Text>
          {pending.map((r) => {
            const p = getPlayer(r.playerId);
            return (
              <View key={r.id} style={styles.pendingRow}>
                <Text style={styles.body}>
                  {p?.name} — {r.type === 'goal' ? 'Gol' : 'Asist'}
                </Text>
                <View style={styles.row}>
                  <PillButton
                    title="Reddet"
                    variant="ghost"
                    onPress={() =>
                      void respondSelfReport(match.id, r.id, false).catch((err) =>
                        Alert.alert('Hata', toUserMessage(err, 'Kaydedilemedi.')),
                      )
                    }
                  />
                  <PillButton
                    title="Onayla"
                    onPress={() =>
                      void respondSelfReport(match.id, r.id, true).catch((err) =>
                        Alert.alert('Hata', toUserMessage(err, 'Kaydedilemedi.')),
                      )
                    }
                  />
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Oyuncular</Text>
        {attendeesSorted.map(({ a, p }) => {
          const showPaidToggle = isOrganizer || p!.id === userId;
          const inMatchLineup =
            match.teamAIds.includes(a.playerId) || match.teamBIds.includes(a.playerId);
          const rr = inMatchLineup ? ratingByPid.get(a.playerId) : undefined;
          return (
            <View key={a.playerId} style={styles.playerRow}>
              <PlayerAvatar name={p!.name} uri={p!.photoUri} showPaid={a.paid} />
              <View style={styles.playerMeta}>
                <Text style={styles.playerName}>{p!.name}</Text>
                <View style={styles.badgesRow}>
                  <PositionBadge position={p!.position} />
                  {match.status === 'finished' && inMatchLineup && motmWinnerIds.has(a.playerId) ? (
                    <View style={styles.motmBadge}>
                      <Text style={styles.motmBadgeTxt}>Maçın adamı</Text>
                    </View>
                  ) : null}
                </View>
                {match.status === 'finished' && inMatchLineup ? (
                  <Text style={styles.micro}>
                    Oy ort.:{' '}
                    {rr && rr.votes_count > 0 && rr.avg != null ? `${rr.avg.toFixed(1)} / 100` : '—'}
                  </Text>
                ) : null}
              </View>
              {showPaidToggle ? (
                <View style={styles.paidRow}>
                  <Text style={styles.micro}>{a.paid ? 'Ödendi' : 'Ödenmedi'}</Text>
                  <Switch
                    value={a.paid}
                    onValueChange={(v) =>
                      void setPaid(match.id, p!.id, v, userId).catch((err) =>
                        Alert.alert('Hata', toUserMessage(err, 'Kaydedilemedi.')),
                      )
                    }
                    trackColor={{ false: colors.border, true: colors.accentMuted }}
                    thumbColor={a.paid ? colors.accent : colors.textMuted}
                  />
                </View>
              ) : (
                <Text style={styles.micro}>{a.paid ? 'Ödendi' : 'Ödenmedi'}</Text>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.section}>
        <PillButton title="Katılım Durumu" onPress={openRsvp} />
        {match.selfReportEnabled && match.status !== 'finished' ? (
          <View style={styles.rowWrap}>
            <PillButton
              title="Gol Attım"
              variant="ghost"
              onPress={() =>
                void addSelfReport(match.id, userId, 'goal').catch((err) =>
                  Alert.alert('Hata', toUserMessage(err, 'Kaydedilemedi.')),
                )
              }
              style={styles.flex}
            />
            <PillButton
              title="Asist Yaptım"
              variant="ghost"
              onPress={() =>
                void addSelfReport(match.id, userId, 'assist').catch((err) =>
                  Alert.alert('Hata', toUserMessage(err, 'Kaydedilemedi.')),
                )
              }
              style={styles.flex}
            />
          </View>
        ) : null}
      </View>

      <BottomSheetModal
        ref={rsvpRef}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetView style={styles.rsvpBody}>
          <Text style={styles.sheetTitle}>Katılım</Text>
          <RsvpGoingButton
            key={rsvpGoingKey}
            onCommit={() => setRSVP(match.id, userId, 'going')}
            onSuccess={() => rsvpRef.current?.dismiss()}
            onError={(e) => Alert.alert('Hata', toUserMessage(e, 'Kaydedilemedi.'))}
            testID="match:rsvp-going:press"
          />
          <PillButton title="Belki" variant="ghost" onPress={() => applyRsvp('maybe')} />
          <PillButton title="Gelmiyorum" variant="ghost" onPress={() => applyRsvp('notGoing')} />
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

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingBottom: TAB_BAR_LIST_PADDING_BOTTOM,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    padding: spacing.lg,
    paddingVertical: spacing.xl,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  heroDate: {
    ...typography.body,
    color: colors.textMuted,
  },
  heroCd: {
    ...typography.subtitle,
    color: colors.accent,
    marginTop: spacing.sm,
  },
  heroCdCancelled: {
    color: colors.danger,
  },
  cancelBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginTop: spacing.xs,
  },
  cancelBadgeTxt: {
    ...typography.micro,
    color: colors.text,
    fontWeight: '700',
    letterSpacing: letterSpacing.wide,
  },
  heroScore: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  section: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.wide,
  },
  body: {
    ...typography.body,
    color: colors.text,
  },
  muted: {
    ...typography.caption,
    color: colors.textMuted,
  },
  iban: {
    ...typography.subtitle,
    color: colors.text,
    letterSpacing: letterSpacing.brand,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowWrap: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  flex: {
    flex: 1,
    minWidth: 120,
  },
  mt: {
    marginTop: spacing.sm,
  },
  mtXs: {
    marginTop: spacing.xs,
  },
  fullRow: {
    width: '100%',
  },
  code: {
    ...typography.subtitle,
    color: colors.accent,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  playerMeta: {
    flex: 1,
    gap: spacing.xs,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  motmBadge: {
    backgroundColor: colors.accentMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  motmBadgeTxt: {
    ...typography.micro,
    color: colors.accent,
    fontWeight: '600',
  },
  playerName: {
    ...typography.body,
    color: colors.text,
  },
  paidRow: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  micro: {
    ...typography.micro,
    color: colors.textMuted,
  },
  pendingRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  sheetBg: {
    backgroundColor: colors.surface,
  },
  handle: {
    backgroundColor: colors.border,
  },
  rsvpBody: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sheetTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.textMuted,
  },
});
