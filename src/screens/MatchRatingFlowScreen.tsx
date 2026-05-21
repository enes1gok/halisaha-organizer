import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotmSelectorSection } from '../components/MotmSelectorSection';
import { PillButton } from '../components/PillButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { getTabBarListPaddingBottom } from '../navigation/tabBarLayout';
import type { GroupsStackParamList, HomeStackParamList } from '../navigation/types';
import { checkHasSubmittedRatings, fetchMyMatchRatingDraftsForMatch } from '../services/supabase/matchRatings';
import { radius, shadows, spacing, typography } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useRatingWindow } from '../hooks/useRatingWindow';
import { QUICK_RATING_BANDS, nearestQuickBandId } from '../utils/matchPeerRatingQuickBands';
import { getMatchContribution, sortPeersByMatchContribution } from '../utils/matchPlayerContribution';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore, useMatchesStore, usePlayersStore } from '../store';
import { useUserFeedback } from '../utils/userFeedback';

type Stacks = HomeStackParamList & GroupsStackParamList;
type RatingFlowRoute =
  | RouteProp<HomeStackParamList, 'MatchRatingFlow'>
  | RouteProp<GroupsStackParamList, 'MatchRatingFlow'>;
type Nav = NativeStackNavigationProp<Stacks>;

const DEFAULT_SCORE = 75;

type FlowStep = 'rating' | 'motm';

function formatCountdown(secondsLeft: number): string {
  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  if (h > 0) return `${h}s ${m}d`;
  if (m > 0) return `${m}d ${s < 10 ? '0' : ''}${s}s`;
  return `${s}s`;
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.background },
    content: { padding: spacing.md, gap: spacing.md },
    center: {
      flex: 1,
      backgroundColor: t.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
      gap: spacing.sm,
    },
    emptyMsg: { ...typography.body, color: t.colors.textMuted, textAlign: 'center' },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    stepLabel: { ...typography.subtitle, color: t.colors.textMuted },
    countdown: { ...typography.caption, color: t.colors.accent },
    anonHint: { ...typography.caption, color: t.colors.textMuted },
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: spacing.lg,
      gap: spacing.md,
      ...shadows.sm,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    cardMeta: { flex: 1, minWidth: 0, gap: spacing.xs },
    playerName: { ...typography.subtitle, color: t.colors.text },
    contrib: { ...typography.caption, color: t.colors.textMuted },
    scoreLbl: { ...typography.body, color: t.colors.accent, fontFamily: 'Inter_700Bold' },
    bandsRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    bandChip: {
      flex: 1,
      minWidth: 70,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      backgroundColor: t.colors.background,
      borderWidth: 1,
      borderColor: t.colors.border,
      paddingHorizontal: spacing.sm,
    },
    bandChipOn: {
      borderColor: t.colors.accent,
      backgroundColor: t.colors.accentMuted,
    },
    bandLbl: { ...typography.caption, color: t.colors.text, fontWeight: '600' },
    bandLblOn: { color: t.colors.accent },
    sectionTitle: { ...typography.subtitle, color: t.colors.text },
    mt: { marginTop: spacing.sm },
  }),
);

export function MatchRatingFlowScreen() {
  const styles = useStyles();
  const route = useRoute<RatingFlowRoute>();
  const navigation = useNavigation<Nav>();
  const { matchId } = route.params;
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.getCurrentUserId());
  const { showValidationToast, showApiErrorToast } = useUserFeedback();

  const getPlayer = usePlayersStore((s) => s.getPlayer);
  const { match, submitMatchRatings } = useMatchesStore(
    useShallow((s) => ({
      match: s.getMatch(matchId),
      submitMatchRatings: s.submitMatchRatings,
    })),
  );

  const ratingWindow = useRatingWindow({
    startsAt: match?.startsAt,
    ratingClosedAt: match?.ratingClosedAt,
    ratingWindowEndsAt: match?.ratingWindowEndsAt,
  });

  const [step, setStep] = useState<FlowStep>('rating');
  const [cardIndex, setCardIndex] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [motmId, setMotmId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const cardAnim = useRef(new Animated.Value(1)).current;

  const peers = useMemo(() => {
    if (!match) return [];
    const ids = new Set<string>();
    match.teamAIds.forEach((id) => ids.add(id));
    match.teamBIds.forEach((id) => ids.add(id));
    ids.delete(userId);
    return sortPeersByMatchContribution(
      match,
      Array.from(ids)
        .map((id) => ({ id, p: getPlayer(id) }))
        .filter((x): x is { id: string; p: NonNullable<ReturnType<typeof getPlayer>> } => Boolean(x.p)),
      (x) => x.p.name,
    );
  }, [match, getPlayer, userId]);

  useEffect(() => {
    if (!match) {
      setLoaded(true);
      return;
    }
    let cancel = false;
    (async () => {
      try {
        // App restart sonrası store sıfırlanmış olsa da sunucu kaydı kontrol edilir
        const submitted = await checkHasSubmittedRatings(match.id);
        if (cancel) return;
        if (submitted) {
          if (match.status === 'finished') {
            navigation.replace('MatchSummary', { matchId: match.id });
          } else {
            navigation.goBack();
          }
          return;
        }

        if (!peers.length) {
          setLoaded(true);
          return;
        }

        const { peerRatings, motmPickPlayerId } = await fetchMyMatchRatingDraftsForMatch(match.id);
        if (cancel) return;
        const next: Record<string, number> = {};
        peers.forEach(({ id }) => {
          const found = peerRatings.find((e) => e.ratee_id === id);
          next[id] = found?.score ?? DEFAULT_SCORE;
        });
        setScores(next);
        setMotmId(motmPickPlayerId ?? null);
      } catch {
        /* sessizce geç — varsayılan skorlar kullanılır */
      } finally {
        if (!cancel) setLoaded(true);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [match?.id, peers]);

  const animateCard = useCallback((callback: () => void) => {
    Animated.sequence([
      Animated.timing(cardAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(cardAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start(() => callback());
  }, [cardAnim]);

  const goNext = useCallback(() => {
    animateCard(() => {
      if (cardIndex < peers.length - 1) {
        setCardIndex((i) => i + 1);
      } else {
        setStep('motm');
      }
    });
  }, [cardIndex, peers.length, animateCard]);

  const selectBand = useCallback((playerId: string, score: number) => {
    setScores((prev) => ({ ...prev, [playerId]: score }));
    setTimeout(goNext, 220);
  }, [goNext]);

  const onSubmit = async () => {
    if (!match) return;
    if (!motmId) {
      showValidationToast('Eksik', 'Maçın adamını seçin.');
      return;
    }
    if (!peers.some((c) => c.id === motmId)) {
      showValidationToast('Geçersiz', 'Maçın adamını yeniden seçin.');
      return;
    }
    const payload = peers.map(({ id }) => ({
      ratee_id: id,
      score: scores[id] ?? DEFAULT_SCORE,
    }));
    setSaving(true);
    try {
      await submitMatchRatings(match.id, payload, motmId);
      navigation.navigate('MatchSummary', { matchId: match.id });
    } catch (e) {
      showApiErrorToast(e, {
        uiOperation: 'MatchRatingFlowScreen:submit',
        fallbackMessage: 'Kaydedilemedi.',
        mapOperation: 'submitMatchRatingsBundleRemote',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!match) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyMsg}>Maç bulunamadı</Text>
      </View>
    );
  }

  if (match.status === 'cancelled') {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyMsg}>Bu maç iptal edildi.</Text>
      </View>
    );
  }

  if (ratingWindow.isClosed) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyMsg}>Oyuncu derecelendirmesi tamamlandı.</Text>
        {match.status === 'finished' ? (
          <PillButton
            title="Sonuçlara git"
            onPress={() => navigation.navigate('MatchSummary', { matchId: match.id })}
            style={styles.mt}
          />
        ) : null}
      </View>
    );
  }

  // Maç henüz başlamamışsa (starts_at gelecekte)
  if (!ratingWindow.isOpen && !ratingWindow.isClosed) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyMsg}>Derecelendirme maç başladığında aktifleşir.</Text>
      </View>
    );
  }

  if (!peers.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyMsg}>Kadroda başka oyuncu yok; değerlendirme yapılamaz.</Text>
      </View>
    );
  }

  const currentPeer = peers[cardIndex];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: getTabBarListPaddingBottom(insets.bottom) }]}
    >
      {/* Üst bilgi */}
      <View style={styles.headerRow}>
        <Text style={styles.stepLabel}>
          {step === 'rating' ? `${cardIndex + 1} / ${peers.length}` : 'Maçın Adamı'}
        </Text>
        {ratingWindow.isOpen && ratingWindow.secondsLeft != null ? (
          <Text style={styles.countdown}>
            ⏱ {formatCountdown(ratingWindow.secondsLeft)}
          </Text>
        ) : null}
      </View>

      <Text style={styles.anonHint}>
        Oylar anonimdir — kim kime puan verdi görünmez.
      </Text>

      {step === 'rating' && currentPeer ? (
        <>
          <Animated.View style={[styles.card, { opacity: cardAnim }]}>
            <View style={styles.cardTop}>
              <PlayerAvatar name={currentPeer.p.name} uri={currentPeer.p.photoUri} size={56} />
              <View style={styles.cardMeta}>
                <Text style={styles.playerName}>{currentPeer.p.name}</Text>
                {(() => {
                  const { goals, assists } = getMatchContribution(match, currentPeer.id);
                  const parts: string[] = [];
                  if (goals > 0) parts.push(`Gol ×${goals}`);
                  if (assists > 0) parts.push(`Asist ×${assists}`);
                  return parts.length > 0 ? (
                    <Text style={styles.contrib}>{parts.join(' · ')}</Text>
                  ) : null;
                })()}
                <Text style={styles.scoreLbl}>
                  {loaded ? (scores[currentPeer.id] ?? DEFAULT_SCORE) : '—'} puan
                </Text>
              </View>
            </View>

            <View style={styles.bandsRow}>
              {QUICK_RATING_BANDS.map((band) => {
                const cur = scores[currentPeer.id] ?? DEFAULT_SCORE;
                const on = nearestQuickBandId(cur) === band.id;
                return (
                  <Pressable
                    key={band.id}
                    style={[styles.bandChip, on && styles.bandChipOn]}
                    onPress={() => selectBand(currentPeer.id, band.score)}
                    accessibilityRole="button"
                    accessibilityLabel={`${currentPeer.p.name} için ${band.label}`}
                    accessibilityState={{ selected: on }}
                    testID={`ratings:quick:band:${band.id}:${currentPeer.id}`}
                    hitSlop={4}
                  >
                    <Text style={[styles.bandLbl, on && styles.bandLblOn]}>{band.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          <PillButton
            title="Geç"
            variant="ghost"
            onPress={goNext}
            testID={`ratings:skip:${currentPeer.id}`}
          />
        </>
      ) : null}

      {step === 'motm' ? (
        <>
          <Text style={styles.sectionTitle}>Maçın en iyi oyuncusunu seçin</Text>
          <MotmSelectorSection
            match={match}
            choices={peers}
            selectedId={motmId}
            onSelect={setMotmId}
          />
          <PillButton
            title={saving ? 'Kaydediliyor…' : 'Puanları gönder'}
            onPress={() => void onSubmit()}
            disabled={saving || !loaded || !motmId}
            style={styles.mt}
            testID="ratings:submit:press"
          />
        </>
      ) : null}
    </ScrollView>
  );
}
