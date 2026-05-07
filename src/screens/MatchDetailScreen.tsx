import * as Clipboard from 'expo-clipboard';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
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
import { PillButton } from '../components/PillButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { PositionBadge } from '../components/PositionBadge';
import { colors, spacing, typography, radius } from '../theme';
import type { RSVPStatus } from '../types/domain';
import { maskIban } from '../utils/iban';
import { formatMatchDateTime } from '../utils/dates';
import { useClipboardCopyFeedback } from '../hooks/useClipboardCopyFeedback';
import { useCountdown } from '../hooks/useCountdown';
import { fetchMyMotmPickForMatch, fetchMyPeerRatingsForMatch } from '../services/supabase/matchRatings';
import { toUserMessage } from '../services/supabase/errors';
import { TAB_BAR_LIST_PADDING_BOTTOM } from '../navigation/tabBarLayout';
import type { GroupsStackParamList, HomeStackParamList, MyMatchesStackParamList } from '../navigation/types';
import { useAuthStore, useMatchesStore, usePlayersStore } from '../store';
import { isRemoteMatchId } from '../utils/matchId';

type MatchStacks = HomeStackParamList & MyMatchesStackParamList & GroupsStackParamList;
type MatchDetailRoute =
  | RouteProp<HomeStackParamList, 'MatchDetail'>
  | RouteProp<MyMatchesStackParamList, 'MatchDetail'>
  | RouteProp<GroupsStackParamList, 'MatchDetail'>;
type Nav = StackNavigationProp<MatchStacks>;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}


export function MatchDetailScreen() {
  const route = useRoute<MatchDetailRoute>();
  const navigation = useNavigation<Nav>();
  const { matchId } = route.params;

  const userId = useAuthStore((s) => s.getCurrentUserId());
  const getPlayer = usePlayersStore((s) => s.getPlayer);
  const setRSVP = useMatchesStore((s) => s.setRSVP);
  const setPaid = useMatchesStore((s) => s.setPaid);
  const setSelfReportEnabled = useMatchesStore((s) => s.setSelfReportEnabled);
  const addSelfReport = useMatchesStore((s) => s.addSelfReport);
  const respondSelfReport = useMatchesStore((s) => s.respondSelfReport);
  const refreshRemoteMatch = useMatchesStore((s) => s.refreshRemoteMatch);
  const loadMatchRatingSummary = useMatchesStore((s) => s.loadMatchRatingSummary);

  const match = useMatchesStore((s) => s.matches.find((m) => m.id === matchId));
  const ratingSummary = useMatchesStore((s) => s.matchRatingSummariesById[matchId]);

  const [ratingHints, setRatingHints] = useState({ peer: false, motm: false });

  const rsvpRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['32%'], []);
  const [refreshing, setRefreshing] = useState(false);

  const countdown = useCountdown(match?.startsAt ?? new Date().toISOString());

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

  const { label: joinCopyLabel, runCopy: runJoinCopy, isCopied: joinCopied } = useClipboardCopyFeedback({
    idleLabel: 'Kodu Kopyala',
  });
  const { label: ibanCopyLabel, runCopy: runIbanCopy, isCopied: ibanCopied } = useClipboardCopyFeedback({
    idleLabel: 'IBAN Kopyala',
  });

  const attendeesSorted = useMemo(() => {
    if (!match) return [];
    return [...match.attendees]
      .map((a) => ({ a, p: getPlayer(a.playerId) }))
      .filter((x) => x.p)
      .sort((x, y) => (x.p!.name > y.p!.name ? 1 : -1));
  }, [match, getPlayer]);

  const onPressCopyJoin = useCallback(() => {
    if (!match) return;
    runJoinCopy(async () => {
      await Clipboard.setStringAsync(`halisaha://match/${match.id}`);
    });
  }, [match, runJoinCopy]);

  const onPressCopyIban = useCallback(() => {
    const iban = match?.iban;
    if (!iban) return;
    runIbanCopy(async () => {
      await Clipboard.setStringAsync(iban.replace(/\s/g, ''));
    });
  }, [match?.iban, runIbanCopy]);

  const openRsvp = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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

  const pending = match.selfReports.filter((r) => r.status === 'pending');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <View style={styles.hero}>
        <Text style={styles.heroVenue}>{match.venue}</Text>
        <Text style={styles.heroDate}>{formatMatchDateTime(match.startsAt)}</Text>
        <Text style={styles.heroCd}>{match.status === 'upcoming' ? countdown : 'Maç Bitti'}</Text>
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
            accessibilityLabel={joinCopied ? 'Kopyalandı' : 'Katılım bağlantısını panoya kopyala'}
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
          />
        </View>
      ) : null}

      {showPrice && match.iban ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ödeme</Text>
          <Text style={styles.muted}>Kişi başı ₺{match.pricePerPerson}</Text>
          <Text style={styles.iban}>{maskIban(match.iban)}</Text>
          <PillButton
            title={ibanCopyLabel}
            onPress={onPressCopyIban}
            style={styles.mt}
            titleColor={ibanCopied ? colors.copyFeedbackLight : undefined}
            accessibilityLabel={ibanCopied ? 'Kopyalandı' : 'IBAN\'ı panoya kopyala'}
          />
        </View>
      ) : null}

      {isOrganizer ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yönetim</Text>
          <View style={styles.rowWrap}>
            {!match.lineupLocked && match.status === 'upcoming' ? (
              <PillButton
                title="Kadro Kur"
                onPress={() => navigation.navigate('LineupBuilder', { matchId })}
                style={styles.flex}
              />
            ) : null}
            {match.status !== 'finished' ? (
              <PillButton
                title="Maç sonrası"
                onPress={() => navigation.navigate('MatchPostgame', { matchId })}
                variant="ghost"
                style={styles.flex}
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
                    {rr && rr.votes_count > 0 && rr.avg != null ? rr.avg.toFixed(1) : '—'}
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
          <PillButton title="Gidiyorum" onPress={() => applyRsvp('going')} />
          <PillButton title="Belki" variant="ghost" onPress={() => applyRsvp('maybe')} />
          <PillButton title="Gelmiyorum" variant="ghost" onPress={() => applyRsvp('notGoing')} />
        </BottomSheetView>
      </BottomSheetModal>

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
  heroVenue: {
    ...typography.title,
    color: colors.text,
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
    letterSpacing: 0.6,
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
    letterSpacing: 1,
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
