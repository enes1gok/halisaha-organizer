import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { ConfirmationModal } from './ConfirmationModal';
import { PillButton } from './PillButton';
import { PlayerAvatar } from './PlayerAvatar';
import { TEAM_SIDE_LABELS } from '../constants/teamLabels';
import { colors, spacing, typography } from '../theme';
import type { Match, ScoreResult } from '../types/domain';
import { useMatchesStore, usePlayersStore } from '../store';
import { showUserFacingErrorAlert } from './UserFacingErrorAlert';

export function toScoreLines(map: Record<string, number>): { playerId: string; count: number }[] {
  return Object.entries(map)
    .filter(([, c]) => c > 0)
    .map(([playerId, count]) => ({ playerId, count }));
}

export type PostMatchScoreFormProps = {
  match: Match;
  canEditScore: boolean;
  showSelfReportToggle: boolean;
  onScoreSubmitted?: () => void;
};

export function PostMatchScoreForm({
  match,
  canEditScore,
  showSelfReportToggle,
  onScoreSubmitted,
}: PostMatchScoreFormProps) {
  const getPlayer = usePlayersStore((s) => s.getPlayer);
  const submitScore = useMatchesStore((s) => s.submitScore);
  const setSelfReportEnabled = useMatchesStore((s) => s.setSelfReportEnabled);

  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [goals, setGoals] = useState<Record<string, number>>({});
  const [assists, setAssists] = useState<Record<string, number>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (match.result) {
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
  }, [match.id, match.result]);

  const playersList = useMemo(() => {
    const ids = new Set<string>();
    match.teamAIds.forEach((id) => ids.add(id));
    match.teamBIds.forEach((id) => ids.add(id));
    match.attendees
      .filter((x) => x.status === 'going')
      .forEach((x) => ids.add(x.playerId));
    return Array.from(ids)
      .map((id) => getPlayer(id))
      .filter(Boolean) as NonNullable<ReturnType<typeof getPlayer>>[];
  }, [match.teamAIds, match.teamBIds, match.attendees, getPlayer]);

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
    const result: ScoreResult = {
      scoreA,
      scoreB,
      scorers: toScoreLines(goals),
      assists: toScoreLines(assists),
    };
    try {
      await submitScore(match.id, result);
      setConfirmOpen(false);
      onScoreSubmitted?.();
    } catch (e) {
      showUserFacingErrorAlert(e, {
        uiOperation: 'PostMatchScoreForm.applySubmit',
        fallbackMessage: 'Skor kaydedilemedi.',
        mapOperation: 'submitMatchResultRpc',
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHead}>Maç sonucu</Text>
      {canEditScore ? (
        <View style={styles.scoreRow}>
          <Text style={styles.teamLbl}>{TEAM_SIDE_LABELS.A}</Text>
          <View style={styles.bigScore}>
            <Pressable onPress={() => setScoreA(Math.max(0, scoreA - 1))} style={styles.stepBtn} testID="postmatch:scoreA:dec">
              <Text style={styles.stepTxt}>−</Text>
            </Pressable>
            <Text style={styles.scoreTxt}>{scoreA}</Text>
            <Pressable onPress={() => setScoreA(scoreA + 1)} style={styles.stepBtn} testID="postmatch:scoreA:inc">
              <Text style={styles.stepTxt}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.sep}>—</Text>
          <View style={styles.bigScore}>
            <Pressable onPress={() => setScoreB(Math.max(0, scoreB - 1))} style={styles.stepBtn} testID="postmatch:scoreB:dec">
              <Text style={styles.stepTxt}>−</Text>
            </Pressable>
            <Text style={styles.scoreTxt}>{scoreB}</Text>
            <Pressable onPress={() => setScoreB(scoreB + 1)} style={styles.stepBtn} testID="postmatch:scoreB:inc">
              <Text style={styles.stepTxt}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.teamLbl}>{TEAM_SIDE_LABELS.B}</Text>
        </View>
      ) : match.result ? (
        <Text style={styles.roBody}>
          Skor: {match.result.scoreA} – {match.result.scoreB}
        </Text>
      ) : (
        <Text style={styles.roBody}>Bu maç için skor düzenlenemez.</Text>
      )}

      {canEditScore ? (
        <>
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
        </>
      ) : null}

      {showSelfReportToggle ? (
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Oyuncular kendi bildirsin</Text>
          <Switch
            value={match.selfReportEnabled}
            onValueChange={(v) =>
              void setSelfReportEnabled(match.id, v).catch((err) =>
                showUserFacingErrorAlert(err, {
                  uiOperation: 'PostMatchScoreForm.selfReportToggle',
                  fallbackMessage: 'Kaydedilemedi.',
                  mapOperation: 'updateMatchOrganizerFieldsRemote',
                }),
              )
            }
            trackColor={{ false: colors.border, true: colors.accentMuted }}
            thumbColor={match.selfReportEnabled ? colors.accent : '#888'}
          />
        </View>
      ) : null}

      {canEditScore ? (
        <PillButton title="Sonucu gönder" onPress={() => setConfirmOpen(true)} testID="postmatch:score:submit" />
      ) : null}

      <ConfirmationModal
        visible={confirmOpen}
        title="Skoru kaydet?"
        message="Oyuncu istatistikleri güncellenecek."
        confirmLabel="Kaydet"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={applySubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  sectionHead: { ...typography.subtitle, color: colors.text },
  roBody: { ...typography.body, color: colors.textMuted },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  teamLbl: { ...typography.caption, color: colors.textMuted, width: 56 },
  bigScore: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
  stepTxt: { fontSize: 22, color: colors.text, fontFamily: 'Inter_600SemiBold' },
  sep: { ...typography.title, color: colors.textMuted },
  section: { ...typography.subtitle, color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  name: { ...typography.body, color: colors.text, flex: 1 },
  stepSmall: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ct: { ...typography.subtitle, color: colors.text, minWidth: 28, textAlign: 'center' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: spacing.md,
    paddingVertical: spacing.sm,
  },
  toggleLabel: { ...typography.body, color: colors.text, flex: 1, marginRight: spacing.md },
});
