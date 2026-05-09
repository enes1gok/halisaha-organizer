import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PillButton } from '../components/PillButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { TAB_BAR_LIST_PADDING_BOTTOM } from '../navigation/tabBarLayout';
import type { GroupsStackParamList, HomeStackParamList, MyMatchesStackParamList } from '../navigation/types';
import { toUserMessage } from '../services/supabase/errors';
import { fetchMyMotmPickForMatch, fetchMyPeerRatingsForMatch } from '../services/supabase/matchRatings';
import { colors, radius, spacing, typography } from '../theme';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore, useMatchesStore, usePlayersStore } from '../store';

type Stacks = HomeStackParamList & MyMatchesStackParamList & GroupsStackParamList;
type RatingsRoute =
  | RouteProp<HomeStackParamList, 'MatchRatings'>
  | RouteProp<MyMatchesStackParamList, 'MatchRatings'>
  | RouteProp<GroupsStackParamList, 'MatchRatings'>;
type Nav = NativeStackNavigationProp<Stacks>;

const DEFAULT_SCORE = 70;
const SCORE_STEP = 5;

export function MatchRatingsScreen() {
  const route = useRoute<RatingsRoute>();
  const navigation = useNavigation<Nav>();
  const { matchId } = route.params;
  const userId = useAuthStore((s) => s.getCurrentUserId());

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

  const rateablePeers = useMemo(() => {
    if (!match) return [];
    const ids = new Set<string>();
    match.teamAIds.forEach((id) => ids.add(id));
    match.teamBIds.forEach((id) => ids.add(id));
    ids.delete(userId);
    return Array.from(ids)
      .map((id) => ({ id, p: getPlayer(id) }))
      .filter((x) => x.p)
      .sort((a, b) => (a.p!.name > b.p!.name ? 1 : -1));
  }, [match, getPlayer, userId]);

  const motmChoices = useMemo(() => {
    if (!match) return [];
    const ids = new Set<string>();
    match.teamAIds.forEach((id) => ids.add(id));
    match.teamBIds.forEach((id) => ids.add(id));
    ids.delete(userId);
    return Array.from(ids)
      .map((id) => ({ id, p: getPlayer(id) }))
      .filter((x) => x.p)
      .sort((a, b) => (a.p!.name > b.p!.name ? 1 : -1));
  }, [match, getPlayer, userId]);

  useEffect(() => {
    if (!match || !rateablePeers.length) {
      setLoaded(true);
      return;
    }
    let cancel = false;
    setLoaded(false);
    (async () => {
      try {
        const [existing, motm] = await Promise.all([
          fetchMyPeerRatingsForMatch(match.id),
          fetchMyMotmPickForMatch(match.id),
        ]);
        if (cancel) return;
        const next: Record<string, number> = {};
        rateablePeers.forEach(({ id }) => {
          const found = existing.find((e) => e.ratee_id === id);
          next[id] = found?.score ?? DEFAULT_SCORE;
        });
        setScores(next);
        setMotmId(motm && motmChoices.some((c) => c.id === motm) ? motm : null);
      } catch (e) {
        if (!cancel) {
          Alert.alert('Hata', toUserMessage(e, 'Veriler yüklenemedi.'));
        }
      } finally {
        if (!cancel) setLoaded(true);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [match, userId, rateablePeers, motmChoices]);

  const bump = useCallback((playerId: string, delta: number) => {
    setScores((prev) => {
      const cur = prev[playerId] ?? DEFAULT_SCORE;
      const v = Math.min(100, Math.max(0, cur + delta));
      return { ...prev, [playerId]: v };
    });
  }, []);

  const onSave = async () => {
    if (!match) return;
    if (!motmId) {
      Alert.alert('Eksik', 'Maçın adamını seçin.');
      return;
    }
    if (!motmChoices.some((c) => c.id === motmId)) {
      Alert.alert('Geçersiz', 'Maçın adamını yeniden seçin.');
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
      Alert.alert('Hata', toUserMessage(e, 'Kaydedilemedi.'));
    } finally {
      setSaving(false);
    }
  };

  if (!match) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textMuted }}>Maç bulunamadı</Text>
      </View>
    );
  }

  if (match.status !== 'finished') {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textMuted }}>Derecelendirme yalnızca bitmiş maçlarda yapılabilir.</Text>
      </View>
    );
  }

  if (!motmChoices.length) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textMuted }}>
          Kadroda başka oyuncu yoksa derecelendirme yapılamaz.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_LIST_PADDING_BOTTOM }]}
    >
      <Text style={styles.lead}>
        Kadrodaki diğer oyunculara 0–100 arası puan verin. Oy verenleri kimse bilemez; herkes özeti görür.
      </Text>

      <Text style={styles.sectionTitle}>Maçın adamı</Text>
      <View style={styles.list}>
        {motmChoices.map(({ id, p }) => (
          <Pressable
            key={`motm-${id}`}
            style={[styles.motmRow, motmId === id && styles.motmRowSelected]}
            onPress={() => setMotmId(id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: motmId === id }}
            accessibilityLabel={`Maçın adamı ${p!.name}`}
            testID={`ratings:motm:${id}`}
          >
            <PlayerAvatar name={p!.name} uri={p!.photoUri} size={36} />
            <Text style={styles.body}>{p!.name}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Oyuncu puanları</Text>
      <View style={styles.list}>
        {rateablePeers.map(({ id, p }) => (
          <View key={`score-${id}`} style={styles.scoreRow}>
            <PlayerAvatar name={p!.name} uri={p!.photoUri} size={36} />
            <View style={styles.scoreMeta}>
              <Text style={styles.body}>{p!.name}</Text>
              <Text style={styles.micro}>0 – 100</Text>
            </View>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => bump(id, -SCORE_STEP)}
                style={styles.stepBtn}
                accessibilityRole="button"
                accessibilityLabel={`${p!.name} puanını azalt`}
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
                accessibilityRole="button"
                accessibilityLabel={`${p!.name} puanını artır`}
                testID={`ratings:score:inc:${id}`}
              >
                <Text style={styles.stepLbl}>+</Text>
              </Pressable>
            </View>
          </View>
        ))}
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
  motmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  motmRowSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scoreMeta: { flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stepBtn: {
    minWidth: 40,
    height: 36,
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
