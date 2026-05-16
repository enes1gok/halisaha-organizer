import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { ConfirmationModal } from './ConfirmationModal';
import { PillButton } from './PillButton';
import { PlayerAvatar } from './PlayerAvatar';
import { TEAM_SIDE_LABELS } from '../constants/teamLabels';
import { radius, spacing, typography } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import type { Match, Player, ScoreResult } from '../types/domain';
import { useMatchesStore, usePlayersStore } from '../store';
import { useUserFeedback } from '../utils/userFeedback';
import { formatMatchDateTime } from '../utils/dates';
import {
  goalsTotalMatchesScore,
  totalGoalsFromStatMap,
} from '../utils/postMatchScoreValidation';

export function toScoreLines(map: Record<string, number>): { playerId: string; count: number }[] {
  return Object.entries(map)
    .filter(([, c]) => c > 0)
    .map(([playerId, count]) => ({ playerId, count }));
}

export type PostMatchScoreFormProps = {
  match: Match;
  canEditScore: boolean;
  /** Skor girişi kapalıysa neden (bilgilendirme metni). */
  scoreUnavailableReason?: 'time' | 'permission';
  /** `scoreUnavailableReason === 'time'` iken tahmini bitiş (ISO). */
  matchEndsAtIso?: string;
  showSelfReportToggle: boolean;
  onScoreSubmitted?: () => void;
};

type QuickSegment = 'teamA' | 'teamB' | 'unassigned';

function QuickSelectPlayerRow({
  player,
  segment,
  goals,
  assists,
  bumpGoals,
  bumpAssists,
}: {
  player: Player;
  segment: QuickSegment;
  goals: Record<string, number>;
  assists: Record<string, number>;
  bumpGoals: (playerId: string, delta: number) => void;
  bumpAssists: (playerId: string, delta: number) => void;
}) {
  const styles = useStyles();
  const idPrefix =
    segment === 'teamA'
      ? 'postmatch:teamA'
      : segment === 'teamB'
        ? 'postmatch:teamB'
        : 'postmatch:unassigned';

  return (
    <View
      style={styles.row}
      accessibilityLabel={`${player.name}, gol ${goals[player.id] ?? 0}, asist ${assists[player.id] ?? 0}`}
    >
      <PlayerAvatar name={player.name} uri={player.photoUri} size={32} />
      <Text style={styles.name} numberOfLines={1}>
        {player.name}
      </Text>
      <View style={styles.statsPair}>
        <View style={styles.statCluster}>
          <Text style={styles.statLabel}>Gol</Text>
          <View style={styles.stepSmall}>
            <Pressable
              onPress={() => bumpGoals(player.id, -1)}
              style={styles.stepCompact}
              testID={`${idPrefix}:player:${player.id}:goal:dec`}
              accessibilityLabel={`${player.name}, gol azalt`}
              accessibilityRole="button"
            >
              <Text style={styles.stepTxtSmall}>−</Text>
            </Pressable>
            <Text style={styles.ct}>{goals[player.id] ?? 0}</Text>
            <Pressable
              onPress={() => bumpGoals(player.id, 1)}
              style={styles.stepCompact}
              testID={`${idPrefix}:player:${player.id}:goal:inc`}
              accessibilityLabel={`${player.name}, gol artır`}
              accessibilityRole="button"
            >
              <Text style={styles.stepTxtSmall}>+</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.statCluster}>
          <Text style={styles.statLabel}>Asist</Text>
          <View style={styles.stepSmall}>
            <Pressable
              onPress={() => bumpAssists(player.id, -1)}
              style={styles.stepCompact}
              testID={`${idPrefix}:player:${player.id}:assist:dec`}
              accessibilityLabel={`${player.name}, asist azalt`}
              accessibilityRole="button"
            >
              <Text style={styles.stepTxtSmall}>−</Text>
            </Pressable>
            <Text style={styles.ct}>{assists[player.id] ?? 0}</Text>
            <Pressable
              onPress={() => bumpAssists(player.id, 1)}
              style={styles.stepCompact}
              testID={`${idPrefix}:player:${player.id}:assist:inc`}
              accessibilityLabel={`${player.name}, asist artır`}
              accessibilityRole="button"
            >
              <Text style={styles.stepTxtSmall}>+</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    container: { gap: spacing.sm },
    sectionHead: { ...typography.subtitle, color: t.colors.text },
    roBody: { ...typography.body, color: t.colors.textMuted },
    scoreBlock: { gap: spacing.sm, marginBottom: spacing.sm },
    scoreTeamRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    scoreTeamLbl: {
      ...typography.caption,
      color: t.colors.textMuted,
      flex: 1,
      textAlign: 'center',
      minWidth: 0,
    },
    scoreVs: {
      ...typography.caption,
      color: t.colors.textMuted,
      marginHorizontal: spacing.xs,
    },
    scoreSeparator: {
      fontSize: 32,
      fontFamily: 'Inter_700Bold',
      color: t.colors.textMuted,
      marginHorizontal: spacing.sm,
    },
    bigScore: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    bigScoreSide: { flex: 1, justifyContent: 'center' },
    scoreTxt: {
      fontSize: 44,
      fontFamily: 'Inter_700Bold',
      color: t.colors.accent,
      minWidth: 56,
      textAlign: 'center',
    },
    stepBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.surface,
    },
    stepTxt: { fontSize: 22, color: t.colors.text, fontFamily: 'Inter_600SemiBold' },
    quickSectionTitle: {
      ...typography.subtitle,
      color: t.colors.text,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    quickHint: { ...typography.caption, color: t.colors.textMuted, marginBottom: spacing.sm },
    teamSectionHead: {
      ...typography.subtitle,
      color: t.colors.text,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    emptyTeam: { ...typography.caption, color: t.colors.textMuted, paddingVertical: spacing.xs },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    name: { ...typography.body, color: t.colors.text, flex: 1, minWidth: 0 },
    statsPair: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, flexShrink: 1, flexWrap: 'wrap', justifyContent: 'flex-end' },
    statCluster: { alignItems: 'center', gap: spacing.xs },
    statLabel: { ...typography.micro, color: t.colors.textMuted },
    stepSmall: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    stepCompact: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepTxtSmall: { fontSize: 20, color: t.colors.text, fontFamily: 'Inter_600SemiBold' },
    ct: { ...typography.subtitle, color: t.colors.text, minWidth: 24, textAlign: 'center' },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginVertical: spacing.md,
      paddingVertical: spacing.sm,
    },
    toggleLabel: { ...typography.body, color: t.colors.text, flex: 1, marginRight: spacing.md },
    validationBox: {
      padding: spacing.md,
      borderRadius: radius.sm,
      backgroundColor: t.colors.surface,
      gap: spacing.xs,
      borderWidth: StyleSheet.hairlineWidth,
    },
    validationBoxOk: {
      borderColor: t.colors.border,
    },
    validationBoxErr: {
      borderColor: t.colors.danger,
    },
    validationTitle: { ...typography.subtitle, color: t.colors.text },
    validationCounts: { ...typography.body, color: t.colors.textMuted },
    validationOk: { ...typography.caption, color: t.colors.textMuted },
    validationWarn: { ...typography.caption, color: t.colors.danger, fontFamily: 'Inter_600SemiBold' },
  })
);

export function PostMatchScoreForm({
  match,
  canEditScore,
  scoreUnavailableReason,
  matchEndsAtIso,
  showSelfReportToggle,
  onScoreSubmitted,
}: PostMatchScoreFormProps) {
  const styles = useStyles();
  const { colors: themeColors } = useTheme();
  const getPlayer = usePlayersStore((s) => s.getPlayer);
  const submitScore = useMatchesStore((s) => s.submitScore);
  const setSelfReportEnabled = useMatchesStore((s) => s.setSelfReportEnabled);
  const { showUserFacingError } = useUserFeedback();

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

  const { teamAPlayers, teamBPlayers, unassignedPlayers } = useMemo(() => {
    const teamAIds = match.teamAIds;
    const teamBIds = match.teamBIds;
    const inTeamA = new Set(teamAIds);

    const teamAPlayers: Player[] = [];
    for (const id of teamAIds) {
      const p = getPlayer(id);
      if (p) teamAPlayers.push(p);
    }

    const teamBPlayers: Player[] = [];
    for (const id of teamBIds) {
      if (inTeamA.has(id)) continue;
      const p = getPlayer(id);
      if (p) teamBPlayers.push(p);
    }

    const assignedIds = new Set<string>([...teamAIds, ...teamBIds]);
    const unassignedPlayers: Player[] = [];
    for (const att of match.attendees) {
      if (att.status !== 'going') continue;
      if (assignedIds.has(att.playerId)) continue;
      const p = getPlayer(att.playerId);
      if (p) unassignedPlayers.push(p);
    }

    return { teamAPlayers, teamBPlayers, unassignedPlayers };
  }, [match.teamAIds, match.teamBIds, match.attendees, getPlayer]);

  const { totalFromScore, totalGoalEvents, goalsMatchScore } = useMemo(() => {
    const totalFromScore = scoreA + scoreB;
    const totalGoalEvents = totalGoalsFromStatMap(goals);
    return {
      totalFromScore,
      totalGoalEvents,
      goalsMatchScore: goalsTotalMatchesScore(scoreA, scoreB, goals),
    };
  }, [scoreA, scoreB, goals]);

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
      ownGoals: [],
    };
    try {
      await submitScore(match.id, result);
      setConfirmOpen(false);
      onScoreSubmitted?.();
    } catch (e) {
      showUserFacingError(e, {
        uiOperation: 'PostMatchScoreForm.applySubmit',
        fallbackMessage: 'Skor kaydedilemedi.',
        mapOperation: 'submitMatchResultRpc',
      });
    }
  };

  const readonlyNoScoreMessage = () => {
    if (scoreUnavailableReason === 'time' && matchEndsAtIso) {
      return `Skor, maçın tahmini bitişinden sonra girilebilir (tahmini bitiş: ${formatMatchDateTime(matchEndsAtIso)}).`;
    }
    if (scoreUnavailableReason === 'permission') {
      return 'Bu maç için skor düzenlenemez.';
    }
    return 'Bu maç için skor düzenlenemez.';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHead}>Maç sonucu</Text>
      {canEditScore ? (
        <View style={styles.scoreBlock}>
          <View style={styles.scoreTeamRow}>
            <Text style={styles.scoreTeamLbl} numberOfLines={1}>
              {TEAM_SIDE_LABELS.A}
            </Text>
            <Text style={styles.scoreVs}>vs</Text>
            <Text style={styles.scoreTeamLbl} numberOfLines={1}>
              {TEAM_SIDE_LABELS.B}
            </Text>
          </View>

          <View style={styles.scoreTeamRow}>
            <View style={[styles.bigScore, styles.bigScoreSide]}>
              <Pressable onPress={() => setScoreA(Math.max(0, scoreA - 1))} style={styles.stepBtn} testID="postmatch:scoreA:dec">
                <Text style={styles.stepTxt}>−</Text>
              </Pressable>
              <Text style={styles.scoreTxt}>{scoreA}</Text>
              <Pressable onPress={() => setScoreA(scoreA + 1)} style={styles.stepBtn} testID="postmatch:scoreA:inc">
                <Text style={styles.stepTxt}>+</Text>
              </Pressable>
            </View>
            <Text style={styles.scoreSeparator}>–</Text>
            <View style={[styles.bigScore, styles.bigScoreSide]}>
              <Pressable onPress={() => setScoreB(Math.max(0, scoreB - 1))} style={styles.stepBtn} testID="postmatch:scoreB:dec">
                <Text style={styles.stepTxt}>−</Text>
              </Pressable>
              <Text style={styles.scoreTxt}>{scoreB}</Text>
              <Pressable onPress={() => setScoreB(scoreB + 1)} style={styles.stepBtn} testID="postmatch:scoreB:inc">
                <Text style={styles.stepTxt}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : match.result ? (
        <Text style={styles.roBody}>
          Skor: {match.result.scoreA} – {match.result.scoreB}
        </Text>
      ) : (
        <Text style={styles.roBody}>{readonlyNoScoreMessage()}</Text>
      )}

      {canEditScore ? (
        <>
          <Text style={styles.quickSectionTitle} accessibilityRole="header">
            Hızlı Seçim
          </Text>
          <Text style={styles.quickHint} accessibilityRole="text">
            Oyuncular takımlarına göre listelenir.
          </Text>

          <Text
            style={styles.teamSectionHead}
            accessibilityRole="header"
            accessibilityLabel={TEAM_SIDE_LABELS.A}
          >
            {TEAM_SIDE_LABELS.A}
          </Text>
          {teamAPlayers.length === 0 ? (
            <Text style={styles.emptyTeam}>Kadroda oyuncu yok.</Text>
          ) : (
            teamAPlayers.map((p) => (
              <QuickSelectPlayerRow
                key={p.id}
                player={p}
                segment="teamA"
                goals={goals}
                assists={assists}
                bumpGoals={(id, d) => bump(setGoals, id, d)}
                bumpAssists={(id, d) => bump(setAssists, id, d)}
              />
            ))
          )}

          <Text
            style={styles.teamSectionHead}
            accessibilityRole="header"
            accessibilityLabel={TEAM_SIDE_LABELS.B}
          >
            {TEAM_SIDE_LABELS.B}
          </Text>
          {teamBPlayers.length === 0 ? (
            <Text style={styles.emptyTeam}>Kadroda oyuncu yok.</Text>
          ) : (
            teamBPlayers.map((p) => (
              <QuickSelectPlayerRow
                key={p.id}
                player={p}
                segment="teamB"
                goals={goals}
                assists={assists}
                bumpGoals={(id, d) => bump(setGoals, id, d)}
                bumpAssists={(id, d) => bump(setAssists, id, d)}
              />
            ))
          )}

          {unassignedPlayers.length > 0 ? (
            <>
              <Text style={styles.teamSectionHead} accessibilityRole="header">
                Takım atanmamış
              </Text>
              {unassignedPlayers.map((p) => (
                <QuickSelectPlayerRow
                  key={p.id}
                  player={p}
                  segment="unassigned"
                  goals={goals}
                  assists={assists}
                  bumpGoals={(id, d) => bump(setGoals, id, d)}
                  bumpAssists={(id, d) => bump(setAssists, id, d)}
                />
              ))}
            </>
          ) : null}
        </>
      ) : null}

      {showSelfReportToggle ? (
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Oyuncular kendi bildirsin</Text>
          <Switch
            value={match.selfReportEnabled}
            onValueChange={(v) =>
              void setSelfReportEnabled(match.id, v).catch((err) =>
                showUserFacingError(err, {
                  uiOperation: 'PostMatchScoreForm.selfReportToggle',
                  fallbackMessage: 'Kaydedilemedi.',
                  mapOperation: 'updateMatchOrganizerFieldsRemote',
                }),
              )
            }
            trackColor={{ false: themeColors.border, true: themeColors.accentMuted }}
            thumbColor={match.selfReportEnabled ? themeColors.accent : themeColors.textMuted}
          />
        </View>
      ) : null}

      {canEditScore ? (
        <View
          style={[styles.validationBox, goalsMatchScore ? styles.validationBoxOk : styles.validationBoxErr]}
          {...(!goalsMatchScore ? { accessibilityRole: 'alert' as const } : {})}
          accessibilityLabel={
            goalsMatchScore
              ? `Doğrulama: Maç skoru ${totalFromScore} gol, gol etkinliği ${totalGoalEvents}, uyumlu.`
              : `Uyarı: Gol dağılımı maç skoruyla uyumsuz. Maç skoru ${totalFromScore} gol; gol etkinliği ${totalGoalEvents}.`
          }
          testID="postmatch:validation:summary"
        >
          <Text style={styles.validationTitle}>Doğrulama özeti</Text>
          <Text style={styles.validationCounts}>
            Maç skoru: {totalFromScore} gol · Gol etkinliği: {totalGoalEvents}
          </Text>
          {goalsMatchScore ? (
            <Text style={styles.validationOk}>Skor ile gol dağılımı uyumlu.</Text>
          ) : (
            <Text style={styles.validationWarn}>
              Takım bazında gol sayıları maç skoruyla eşleşmiyor.
            </Text>
          )}
        </View>
      ) : null}

      {canEditScore ? (
        <PillButton
          title="Sonucu gönder"
          onPress={() => setConfirmOpen(true)}
          disabled={!goalsMatchScore}
          testID="postmatch:score:submit"
          accessibilityState={{ disabled: !goalsMatchScore }}
        />
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
