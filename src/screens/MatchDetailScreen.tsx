import * as Clipboard from 'expo-clipboard';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
import { colors, spacing, typography } from '../theme';
import type { RSVPStatus } from '../types/domain';
import { maskIban } from '../utils/iban';
import { formatMatchDateTime } from '../utils/dates';
import { useCountdown } from '../hooks/useCountdown';
import { TAB_BAR_LIST_PADDING_BOTTOM } from '../navigation/tabBarLayout';
import { useAppStore } from '../store/useAppStore';
import type { HomeStackParamList, MyMatchesStackParamList } from '../navigation/types';

type MatchDetailRoute =
  | RouteProp<HomeStackParamList, 'MatchDetail'>
  | RouteProp<MyMatchesStackParamList, 'MatchDetail'>;

type Nav = NativeStackNavigationProp<HomeStackParamList & MyMatchesStackParamList>;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}


export function MatchDetailScreen() {
  const route = useRoute<MatchDetailRoute>();
  const navigation = useNavigation<Nav>();
  const { matchId } = route.params;

  const userId = useAppStore((s) => s.getCurrentUserId());
  const getPlayer = useAppStore((s) => s.getPlayer);
  const setRSVP = useAppStore((s) => s.setRSVP);
  const setPaid = useAppStore((s) => s.setPaid);
  const setSelfReportEnabled = useAppStore((s) => s.setSelfReportEnabled);
  const addSelfReport = useAppStore((s) => s.addSelfReport);
  const respondSelfReport = useAppStore((s) => s.respondSelfReport);

  const match = useAppStore((s) => s.matches.find((m) => m.id === matchId));

  const rsvpRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['32%'], []);
  const [refreshing, setRefreshing] = useState(false);

  const countdown = useCountdown(match?.startsAt ?? new Date().toISOString());

  const organizer = match ? getPlayer(match.organizerId) : undefined;
  const isOrganizer = match?.organizerId === userId;

  const attendeesSorted = useMemo(() => {
    if (!match) return [];
    return [...match.attendees]
      .map((a) => ({ a, p: getPlayer(a.playerId) }))
      .filter((x) => x.p)
      .sort((x, y) => (x.p!.name > y.p!.name ? 1 : -1));
  }, [match, getPlayer]);

  const copyIban = async () => {
    if (!match?.iban) return;
    await Clipboard.setStringAsync(match.iban.replace(/\s/g, ''));
    Alert.alert('Panoya kopyalandı', 'IBAN kopyalandı.');
  };

  const copyJoin = async () => {
    if (!match) return;
    await Clipboard.setStringAsync(`halisaha://match/${match.id}`);
    Alert.alert('Bağlantı kopyalandı', match.joinCode);
  };

  const openRsvp = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    rsvpRef.current?.present();
  };

  const applyRsvp = (status: RSVPStatus) => {
    if (!match) return;
    setRSVP(match.id, userId, status);
    rsvpRef.current?.dismiss();
  };

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    [],
  );

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  if (!match) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textMuted }}>Maç bulunamadı.</Text>
      </View>
    );
  }

  const showPrice = (match.pricePerPerson ?? 0) > 0;

  const pending = match.selfReports.filter((r) => r.status === 'pending');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: TAB_BAR_LIST_PADDING_BOTTOM }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <View style={styles.hero}>
        <Text style={styles.heroVenue}>{match.venue}</Text>
        <Text style={styles.heroDate}>{formatMatchDateTime(match.startsAt)}</Text>
        <Text style={styles.heroCd}>{match.status === 'upcoming' ? countdown : 'Maç Bitti'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Organizatör</Text>
        <Text style={styles.body}>{organizer?.name ?? '—'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Katılım kodu</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.code}>{match.joinCode}</Text>
          <PillButton title="Kodu Kopyala" variant="ghost" onPress={copyJoin} />
        </View>
      </View>

      {showPrice && match.iban ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ödeme</Text>
          <Text style={styles.muted}>Kişi başı ₺{match.pricePerPerson}</Text>
          <Text style={styles.iban}>{maskIban(match.iban)}</Text>
          <PillButton title="IBAN Kopyala" onPress={copyIban} style={styles.mt} />
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
                title="Skor Gir"
                onPress={() => navigation.navigate('ScoreEntry', { matchId })}
                variant="ghost"
                style={styles.flex}
              />
            ) : null}
          </View>
          <View style={[styles.rowBetween, styles.mt]}>
            <Text style={styles.body}>Oyuncular kendi bildirsin</Text>
            <Switch
              value={match.selfReportEnabled}
              onValueChange={(v) => setSelfReportEnabled(match.id, v)}
              trackColor={{ false: colors.border, true: colors.accentMuted }}
              thumbColor={match.selfReportEnabled ? colors.accent : '#888'}
            />
          </View>
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
                    onPress={() => respondSelfReport(match.id, r.id, false)}
                  />
                  <PillButton title="Onayla" onPress={() => respondSelfReport(match.id, r.id, true)} />
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
          return (
            <View key={a.playerId} style={styles.playerRow}>
              <PlayerAvatar name={p!.name} uri={p!.photoUri} showPaid={a.paid} />
              <View style={styles.playerMeta}>
                <Text style={styles.playerName}>{p!.name}</Text>
                <PositionBadge position={p!.position} />
              </View>
              {showPaidToggle ? (
                <View style={styles.paidRow}>
                  <Text style={styles.micro}>{a.paid ? 'Ödendi' : 'Ödenmedi'}</Text>
                  <Switch
                    value={a.paid}
                    onValueChange={(v) => setPaid(match.id, p!.id, v, userId)}
                    trackColor={{ false: colors.border, true: colors.accentMuted }}
                    thumbColor={a.paid ? colors.accent : '#888'}
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
              onPress={() => addSelfReport(match.id, userId, 'goal')}
              style={styles.flex}
            />
            <PillButton
              title="Asist Yaptım"
              variant="ghost"
              onPress={() => addSelfReport(match.id, userId, 'assist')}
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
    gap: 4,
  },
  playerName: {
    ...typography.body,
    color: colors.text,
  },
  paidRow: {
    alignItems: 'flex-end',
    gap: 4,
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
});
