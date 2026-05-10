import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PillButton } from '../components/PillButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { TAB_BAR_LIST_PADDING_BOTTOM } from '../navigation/tabBarLayout';
import type { GroupsStackParamList, HomeStackParamList, MyMatchesStackParamList } from '../navigation/types';
import { fetchMyMatchRatingDraftsForMatch } from '../services/supabase/matchRatings';
import { colors, radius, shadows, spacing, typography } from '../theme';
import { nearestQuickBandId, QUICK_RATING_BANDS } from '../utils/matchPeerRatingQuickBands';
import { getMatchContribution, sortPeersByMatchContribution } from '../utils/matchPlayerContribution';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore, useMatchesStore, usePlayersStore } from '../store';
import { useUserFeedback } from '../utils/userFeedback';

type Stacks = HomeStackParamList & MyMatchesStackParamList & GroupsStackParamList;
type RatingsRoute =
  | RouteProp<HomeStackParamList, 'MatchRatings'>
  | RouteProp<MyMatchesStackParamList, 'MatchRatings'>
  | RouteProp<GroupsStackParamList, 'MatchRatings'>;
type Nav = NativeStackNavigationProp<Stacks>;

const DEFAULT_SCORE = 70;
const SCORE_STEP = 5;

type RatingMode = 'quick' | 'detailed';

export function MatchRatingsScreen() {
  const route = useRoute<RatingsRoute>();
  const navigation = useNavigation<Nav>();
  const { matchId } = route.params;
  const userId = useAuthStore((s) => s.getCurrentUserId());
  const { showValidationToast, showApiErrorToast } = useUserFeedback();

  const getPlayer = usePlayersStore((s) => s.getPlayer);
  const { match, submitMatchRatings } = useMatchesStore(
    useShallow((s) => ({
      match: s.getMatch(matchId),
      submitMatchRatings: s.submitMatchRatings,
    })),
  );

  const [scores, setScores] = useState<Record<string, number>>({});
  const [motmId, setMotmId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ratingMode, setRatingMode] = useState<RatingMode>('quick');

  const rosterPeersRaw = useMemo(() => {
    if (!match) return [];
    const ids = new Set<string>();
    match.teamAIds.forEach((id) => ids.add(id));
    match.teamBIds.forEach((id) => ids.add(id));
    ids.delete(userId);
    return Array.from(ids)
      .map((id) => ({ id, p: getPlayer(id) }))
      .filter((x): x is { id: string; p: NonNullable<ReturnType<typeof getPlayer>> } => Boolean(x.p));
  }, [match, getPlayer, userId]);

  const rateablePeers = useMemo(
    () =>
      match
        ? sortPeersByMatchContribution(match, rosterPeersRaw, (x) => x.p.name)
        : [],
    [match, rosterPeersRaw],
  );

  const motmChoices = useMemo(
    () =>
      match
        ? sortPeersByMatchContribution(match, rosterPeersRaw, (x) => x.p.name)
        : [],
    [match, rosterPeersRaw],
  );

  useEffect(() => {
    if (!match || !rateablePeers.length) {
      setLoaded(true);
      return;
    }
    let cancel = false;
    setLoaded(false);
    (async () => {
      try {
        const { peerRatings, motmPickPlayerId } = await fetchMyMatchRatingDraftsForMatch(match.id);
        if (cancel) return;
        const next: Record<string, number> = {};
        rateablePeers.forEach(({ id }) => {
          const found = peerRatings.find((e) => e.ratee_id === id);
          next[id] = found?.score ?? DEFAULT_SCORE;
        });
        setScores(next);
        setMotmId(
          motmPickPlayerId && motmChoices.some((c) => c.id === motmPickPlayerId)
            ? motmPickPlayerId
            : null,
        );
      } catch (e) {
        if (!cancel) {
          showApiErrorToast(e, {
            uiOperation: 'MatchRatingsScreen:loadExisting',
            fallbackMessage: 'Veriler yüklenemedi.',
            mapOperation: 'fetchMyMatchRatingDraftsForMatch',
          });
        }
      } finally {
        if (!cancel) setLoaded(true);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [match, userId, rateablePeers, motmChoices, showApiErrorToast]);

  const bump = useCallback((playerId: string, delta: number) => {
    setScores((prev) => {
      const cur = prev[playerId] ?? DEFAULT_SCORE;
      const v = Math.min(100, Math.max(0, cur + delta));
      return { ...prev, [playerId]: v };
    });
  }, []);

  const setBandScore = useCallback((playerId: string, score: number) => {
    setScores((prev) => ({
      ...prev,
      [playerId]: Math.min(100, Math.max(0, score)),
    }));
  }, []);

  const onSave = async () => {
    if (!match) return;
    if (!motmId) {
      showValidationToast('Eksik', 'Maçın adamını seçin.');
      return;
    }
    if (!motmChoices.some((c) => c.id === motmId)) {
      showValidationToast('Geçersiz', 'Maçın adamını yeniden seçin.');
      return;
    }
    const payload = rateablePeers.map(({ id }) => ({
      ratee_id: id,
      score: scores[id] ?? DEFAULT_SCORE,
    }));
    setSaving(true);
    try {
      await submitMatchRatings(match.id, payload, motmId);
      navigation.navigate('MatchSummary', { matchId: match.id });
    } catch (e) {
      showApiErrorToast(e, {
        uiOperation: 'MatchRatingsScreen:submit',
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

  if (match.status !== 'finished') {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyMsg}>Derecelendirme yalnızca bitmiş maçlarda yapılabilir.</Text>
      </View>
    );
  }

  if (!motmChoices.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyMsg}>Kadroda başka oyuncu yoksa derecelendirme yapılamaz.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_LIST_PADDING_BOTTOM }]}
    >
      <Text style={styles.lead}>
        Oy verenleri kimse bilemez; herkes özeti görür. Hızlı modda ön tanımlı puanlar; ayrıntılıda 0–100
        arası adım adım ayarlarsınız.
      </Text>

      <View style={styles.modeBar}>
        <Pressable
          style={[styles.modeChip, ratingMode === 'quick' && styles.modeChipOn]}
          onPress={() => setRatingMode('quick')}
          accessibilityRole="button"
          accessibilityState={{ selected: ratingMode === 'quick' }}
          accessibilityLabel="Hızlı derecelendirme"
          testID="ratings:mode:quick"
        >
          <Text style={[styles.modeChipLbl, ratingMode === 'quick' && styles.modeChipLblOn]}>Hızlı</Text>
        </Pressable>
        <Pressable
          style={[styles.modeChip, ratingMode === 'detailed' && styles.modeChipOn]}
          onPress={() => setRatingMode('detailed')}
          accessibilityRole="button"
          accessibilityState={{ selected: ratingMode === 'detailed' }}
          accessibilityLabel="Ayrıntılı derecelendirme"
          testID="ratings:mode:detailed"
        >
          <Text style={[styles.modeChipLbl, ratingMode === 'detailed' && styles.modeChipLblOn]}>Ayrıntılı</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Maçın adamı</Text>
      <View style={styles.list}>
        {motmChoices.map(({ id, p }) => {
          const { goals, assists } = getMatchContribution(match, id);
          const statParts: string[] = [];
          if (goals > 0) statParts.push(`Gol ×${goals}`);
          if (assists > 0) statParts.push(`Asist ×${assists}`);
          return (
            <Pressable
              key={`motm-${id}`}
              style={[styles.motmRow, motmId === id && styles.motmRowSelected]}
              onPress={() => setMotmId(id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: motmId === id }}
              accessibilityLabel={`Maçın adamı ${p.name}`}
              testID={`ratings:motm:${id}`}
            >
              <PlayerAvatar name={p.name} uri={p.photoUri} size={36} />
              <View style={styles.motmMeta}>
                <Text style={styles.body}>{p.name}</Text>
                {statParts.length > 0 ? (
                  <Text style={styles.micro}>{statParts.join(' · ')}</Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Oyuncu puanları</Text>
      <View style={styles.list}>
        {rateablePeers.map(({ id, p }) => {
          const cur = loaded ? (scores[id] ?? DEFAULT_SCORE) : null;
          const selectedBand = nearestQuickBandId(cur ?? DEFAULT_SCORE);
          return (
            <View key={`score-${id}`} style={styles.scoreRow}>
              <PlayerAvatar name={p.name} uri={p.photoUri} size={36} />
              <View style={styles.scoreBlock}>
                <View style={styles.scoreTopRow}>
                  <View style={styles.scoreMeta}>
                    <Text style={styles.body}>{p.name}</Text>
                    <Text style={styles.micro}>
                      {ratingMode === 'quick' ? `Puan: ${loaded ? cur : '—'}` : '0 – 100'}
                    </Text>
                  </View>
                  {ratingMode === 'detailed' ? (
                    <View
                      accessible
                      accessibilityRole="adjustable"
                      accessibilityLabel={`${p.name} oyuncu puanı`}
                      accessibilityValue={{
                        min: 0,
                        max: 100,
                        now: cur ?? DEFAULT_SCORE,
                        text: `${cur ?? DEFAULT_SCORE} puan`,
                      }}
                      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                      onAccessibilityAction={(e) => {
                        if (e.nativeEvent.actionName === 'increment') bump(id, SCORE_STEP);
                        if (e.nativeEvent.actionName === 'decrement') bump(id, -SCORE_STEP);
                      }}
                      style={styles.stepper}
                      testID={`ratings:score:adjustable:${id}`}
                    >
                      <Pressable
                        onPress={() => bump(id, -SCORE_STEP)}
                        style={styles.stepBtn}
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                        testID={`ratings:score:dec:${id}`}
                      >
                        <Text style={styles.stepLbl}>−</Text>
                      </Pressable>
                      <Text style={styles.scoreLbl} testID={`ratings:score:value:${id}`}>
                        {loaded ? (scores[id] ?? DEFAULT_SCORE) : '—'}
                      </Text>
                      <Pressable
                        onPress={() => bump(id, SCORE_STEP)}
                        style={styles.stepBtn}
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                        testID={`ratings:score:inc:${id}`}
                      >
                        <Text style={styles.stepLbl}>+</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
                {ratingMode === 'quick' ? (
                  <View style={styles.quickBandRow}>
                    {QUICK_RATING_BANDS.map((band) => {
                      const on = selectedBand === band.id;
                      return (
                        <Pressable
                          key={band.id}
                          onPress={() => setBandScore(id, band.score)}
                          style={[styles.quickChip, on && styles.quickChipOn]}
                          accessibilityRole="button"
                          accessibilityLabel={`${p.name} için ${band.label}, ${band.score} puan`}
                          accessibilityState={{ selected: on }}
                          accessibilityValue={{ text: `${band.label}, ${band.score} puan` }}
                          testID={`ratings:quick:band:${band.id}:${id}`}
                          hitSlop={4}
                        >
                          <Text style={[styles.quickChipLbl, on && styles.quickChipLblOn]}>{band.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      <PillButton
        title={saving ? 'Kaydediliyor…' : 'Kaydet'}
        onPress={() => void onSave()}
        disabled={saving || !loaded}
        testID="ratings:submit:press"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  emptyMsg: { color: colors.textMuted },
  lead: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.sm,
  },
  list: { gap: spacing.xs },
  modeBar: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  modeChip: {
    paddingHorizontal: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  modeChipOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  modeChipLbl: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  modeChipLblOn: { color: colors.accent },
  motmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  motmRowSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  motmMeta: { flex: 1, minWidth: 0 },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scoreBlock: { flex: 1, minWidth: 0, gap: spacing.sm },
  scoreTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scoreMeta: { flex: 1, minWidth: 0 },
  quickBandRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    alignItems: 'center',
  },
  quickChip: {
    paddingHorizontal: spacing.sm,
    minHeight: 44,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  quickChipOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  quickChipLbl: { ...typography.micro, color: colors.text },
  quickChipLblOn: { color: colors.accent, fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stepBtn: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLbl: { ...typography.subtitle, color: colors.accent },
  scoreLbl: { ...typography.subtitle, color: colors.text, minWidth: 28, textAlign: 'center' },
  body: { ...typography.body, color: colors.text, flexShrink: 1 },
  micro: { ...typography.micro, color: colors.textMuted },
});
