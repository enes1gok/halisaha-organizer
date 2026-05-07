import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { PillButton } from '../components/PillButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { colors, spacing, typography } from '../theme';
import type { ScoreResult } from '../types/domain';
import { useAuthStore, useMatchesStore, usePlayersStore } from '../store';
import { toUserMessage } from '../services/supabase/errors';
import type { HomeStackParamList, MyMatchesStackParamList } from '../navigation/types';

type Route =
  | RouteProp<HomeStackParamList, 'ScoreEntry'>
  | RouteProp<MyMatchesStackParamList, 'ScoreEntry'>;
type Nav = StackNavigationProp<HomeStackParamList & MyMatchesStackParamList>;

function toLines(map: Record<string, number>) {
  return Object.entries(map)
    .filter(([, c]) => c > 0)
    .map(([playerId, count]) => ({ playerId, count }));
}

export function ScoreEntryScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { matchId } = route.params;

  const userId = useAuthStore((s) => s.getCurrentUserId());
  const match = useMatchesStore((s) => s.matches.find((m) => m.id === matchId));
  const getPlayer = usePlayersStore((s) => s.getPlayer);
  const submitScore = useMatchesStore((s) => s.submitScore);
  const setSelfReportEnabled = useMatchesStore((s) => s.setSelfReportEnabled);

  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [goals, setGoals] = useState<Record<string, number>>({});
  const [assists, setAssists] = useState<Record<string, number>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!match) return;
    if (match.organizerId !== userId) navigation.goBack();
  }, [match, navigation, userId]);

  useEffect(() => {
    if (match?.result) {
      setScoreA(match.result.scoreA);
      setScoreB(match.result.scoreB);
      const g: Record<string, number> = {};
      const a: Record<string, number> = {};
      match.result.scorers.forEach((l) => {
        g[l.playerId] = l.count;
      });
      match.result.assists.forEach((l) => {
        a[l.playerId] = l.count;
      });
      setGoals(g);
      setAssists(a);
    }
  }, [match?.id]);

  const playersList = useMemo(() => {
    if (!match) return [];
    const ids = new Set<string>();
    match.teamAIds.forEach((id) => ids.add(id));
    match.teamBIds.forEach((id) => ids.add(id));
    match.attendees
      .filter((x) => x.status === 'going')
      .forEach((x) => ids.add(x.playerId));
    return Array.from(ids)
      .map((id) => getPlayer(id))
      .filter(Boolean) as NonNullable<ReturnType<typeof getPlayer>>[];
  }, [match, getPlayer]);

  const bump = (
    setter: React.Dispatch<React.SetStateAction<Record<string, number>>>,
    id: string,
    delta: number,
  ) =>
    setter((prev) => {
      const next = { ...prev };
      const v = (next[id] ?? 0) + delta;
      if (v <= 0) delete next[id];
      else next[id] = v;
      return next;
    });

  const applySubmit = async () => {
    if (!match) return;
    const result: ScoreResult = {
      scoreA,
      scoreB,
      scorers: toLines(goals),
      assists: toLines(assists),
    };
    try {
      await submitScore(match.id, result);
      setConfirmOpen(false);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Hata', toUserMessage(e, 'Skor kaydedilemedi.'));
    }
  };

  if (!match) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textMuted }}>Maç bulunamadı</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.scoreRow}>
        <Text style={styles.teamLbl}>Takım A</Text>
        <View style={styles.bigScore}>
          <Pressable onPress={() => setScoreA(Math.max(0, scoreA - 1))} style={styles.stepBtn}>
            <Text style={styles.stepTxt}>−</Text>
          </Pressable>
          <Text style={styles.scoreTxt}>{scoreA}</Text>
          <Pressable onPress={() => setScoreA(scoreA + 1)} style={styles.stepBtn}>
            <Text style={styles.stepTxt}>+</Text>
          </Pressable>
        </View>
        <Text style={styles.sep}>—</Text>
        <View style={styles.bigScore}>
          <Pressable onPress={() => setScoreB(Math.max(0, scoreB - 1))} style={styles.stepBtn}>
            <Text style={styles.stepTxt}>−</Text>
          </Pressable>
          <Text style={styles.scoreTxt}>{scoreB}</Text>
          <Pressable onPress={() => setScoreB(scoreB + 1)} style={styles.stepBtn}>
            <Text style={styles.stepTxt}>+</Text>
          </Pressable>
        </View>
        <Text style={styles.teamLbl}>Takım B</Text>
      </View>

      <Text style={styles.section}>Gol atanlar</Text>
      {playersList.map((p) => (
        <View key={p.id} style={styles.row}>
          <PlayerAvatar name={p.name} uri={p.photoUri} size={32} />
          <Text style={styles.name}>{p.name}</Text>
          <View style={styles.stepSmall}>
            <Pressable onPress={() => bump(setGoals, p.id, -1)}>
              <Text style={styles.stepTxt}>−</Text>
            </Pressable>
            <Text style={styles.ct}>{goals[p.id] ?? 0}</Text>
            <Pressable onPress={() => bump(setGoals, p.id, 1)}>
              <Text style={styles.stepTxt}>+</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Text style={styles.section}>Asistler</Text>
      {playersList.map((p) => (
        <View key={`a-${p.id}`} style={styles.row}>
          <PlayerAvatar name={p.name} uri={p.photoUri} size={32} />
          <Text style={styles.name}>{p.name}</Text>
          <View style={styles.stepSmall}>
            <Pressable onPress={() => bump(setAssists, p.id, -1)}>
              <Text style={styles.stepTxt}>−</Text>
            </Pressable>
            <Text style={styles.ct}>{assists[p.id] ?? 0}</Text>
            <Pressable onPress={() => bump(setAssists, p.id, 1)}>
              <Text style={styles.stepTxt}>+</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Oyuncular kendi bildirsin</Text>
        <Switch
          value={match.selfReportEnabled}
          onValueChange={(v) =>
            void setSelfReportEnabled(match.id, v).catch((err) =>
              Alert.alert('Hata', toUserMessage(err, 'Kaydedilemedi.')),
            )
          }
          trackColor={{ false: colors.border, true: colors.accentMuted }}
          thumbColor={match.selfReportEnabled ? colors.accent : '#888'}
        />
      </View>

      <PillButton title="Sonucu Gönder" onPress={() => setConfirmOpen(true)} />

      <ConfirmationModal
        visible={confirmOpen}
        title="Skoru kaydet?"
        message="Oyuncu istatistikleri güncellenecek. Bu işlem geri alınamaz."
        confirmLabel="Kaydet"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={applySubmit}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  teamLbl: {
    ...typography.caption,
    color: colors.textMuted,
    width: 56,
  },
  bigScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scoreTxt: {
    fontSize: 44,
    fontFamily: 'Inter_700Bold',
    color: colors.accent,
    minWidth: 56,
    textAlign: 'center',
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  stepTxt: {
    fontSize: 22,
    color: colors.text,
    fontFamily: 'Inter_600SemiBold',
  },
  sep: {
    ...typography.title,
    color: colors.textMuted,
  },
  section: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  name: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  stepSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ct: {
    ...typography.subtitle,
    color: colors.text,
    minWidth: 28,
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: spacing.md,
    paddingVertical: spacing.sm,
  },
  toggleLabel: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    marginRight: spacing.md,
  },
});
