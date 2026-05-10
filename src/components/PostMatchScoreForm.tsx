import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { ConfirmationModal } from './ConfirmationModal';
import { PillButton } from './PillButton';
import { PlayerAvatar } from './PlayerAvatar';
import { TEAM_SIDE_LABELS } from '../constants/teamLabels';
import { colors, radius, spacing, typography } from '../theme';
import type { Match, Player, ScoreResult } from '../types/domain';
import { useMatchesStore, usePlayersStore } from '../store';
import { showUserFacingErrorAlert } from './UserFacingErrorAlert';
import { formatMatchDateTime } from '../utils/dates';
import {
  scoreAndStatLinesConsistent,
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
  ownGoals,
  bumpGoals,
  bumpAssists,
  bumpOwnGoals,
}: {
  player: Player;
  segment: QuickSegment;
  goals: Record<string, number>;
  assists: Record<string, number>;
  ownGoals: Record<string, number>;
  bumpGoals: (playerId: string, delta: number) => void;
  bumpAssists: (playerId: string, delta: number) => void;
  bumpOwnGoals: (playerId: string, delta: number) => void;
}) {
  const showOwnGoals = segment === 'teamA' || segment === 'teamB';
  const idPrefix =
    segment === 'teamA'
      ? 'postmatch:teamA'
      : segment === 'teamB'
        ? 'postmatch:teamB'
        : 'postmatch:unassigned';

  return (
    <View
      style={styles.row}
      accessibilityLabel={`${player.name}, gol ${goals[player.id] ?? 0}, asist ${assists[player.id] ?? 0}${showOwnGoals ? `, KK ${ownGoals[player.id] ?? 0}` : ''}`}
    >
      <PlayerAvatar name={player.name} uri={player.photoUri} size={32} />
      <Text style={styles.name} numberOfLines={1}>
        {player.name}
      </Text>
      <View style={[styles.statsPair, showOwnGoals && styles.statsTripleWrap]}>
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
        {showOwnGoals ? (
          <View style={styles.statCluster}>
            <Text style={styles.statLabel}>KK</Text>
            <View style={styles.stepSmall}>
              <Pressable
                onPress={() => bumpOwnGoals(player.id, -1)}
                style={styles.stepCompact}
                testID={`${idPrefix}:player:${player.id}:ownGoal:dec`}
                accessibilityLabel={`${player.name}, kendi kale gol azalt`}
                accessibilityRole="button"
              >
                <Text style={styles.stepTxtSmall}>−</Text>
              </Pressable>
              <Text style={styles.ct}>{ownGoals[player.id] ?? 0}</Text>
              <Pressable
                onPress={() => bumpOwnGoals(player.id, 1)}
                style={styles.stepCompact}
                testID={`${idPrefix}:player:${player.id}:ownGoal:inc`}
                accessibilityLabel={`${player.name}, kendi kale gol artır`}
                accessibilityRole="button"
              >
                <Text style={styles.stepTxtSmall}>+</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function PostMatchScoreForm({
  match,
  canEditScore,
  scoreUnavailableReason,
  matchEndsAtIso,
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
  const [ownGoals, setOwnGoals] = useState<Record<string, number>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (match.result) {
      setScoreA(match.result.scoreA);
      setScoreB(match.result.scoreB);
      const g: Record<string, number> = {};
      const a: Record<string, number> = {};
      const og: Record<string, number> = {};
      match.result.scorers.forEach((l) => {
        g[l.playerId] = l.count;
      });
      match.result.assists.forEach((l) => {
        a[l.playerId] = l.count;
      });
      (match.result.ownGoals ?? []).forEach((l) => {
        og[l.playerId] = l.count;
      });
      setGoals(g);
      setAssists(a);
      setOwnGoals(og);
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
    const totalGoalEvents = totalGoalsFromStatMap(goals) + totalGoalsFromStatMap(ownGoals);
    return {
      totalFromScore,
      totalGoalEvents,
      goalsMatchScore: scoreAndStatLinesConsistent(
        scoreA,
        scoreB,
        match.teamAIds,
        match.teamBIds,
        goals,
        ownGoals,
      ),
    };
  }, [scoreA, scoreB, goals, ownGoals, match.teamAIds, match.teamBIds]);

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
      ownGoals: toScoreLines(ownGoals),
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
          <View style={styles.teamScoreLine}>
            <Text style={styles.teamLbl} numberOfLines={2}>
              {TEAM_SIDE_LABELS.A}
            </Text>
            <View style={styles.bigScore}>
              <Pressable onPress={() => setScoreA(Math.max(0, scoreA - 1))} style={styles.stepBtn} testID="postmatch:scoreA:dec">
                <Text style={styles.stepTxt}>−</Text>
              </Pressable>
              <Text style={styles.scoreTxt}>{scoreA}</Text>
              <Pressable onPress={() => setScoreA(scoreA + 1)} style={styles.stepBtn} testID="postmatch:scoreA:inc">
                <Text style={styles.stepTxt}>+</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.teamDivider} />
          <View style={styles.teamScoreLine}>
            <Text style={styles.teamLbl} numberOfLines={2}>
              {TEAM_SIDE_LABELS.B}
            </Text>
            <View style={styles.bigScore}>
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
                ownGoals={ownGoals}
                bumpGoals={(id, d) => bump(setGoals, id, d)}
                bumpAssists={(id, d) => bump(setAssists, id, d)}
                bumpOwnGoals={(id, d) => bump(setOwnGoals, id, d)}
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
                ownGoals={ownGoals}
                bumpGoals={(id, d) => bump(setGoals, id, d)}
                bumpAssists={(id, d) => bump(setAssists, id, d)}
                bumpOwnGoals={(id, d) => bump(setOwnGoals, id, d)}
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
                  ownGoals={ownGoals}
                  bumpGoals={(id, d) => bump(setGoals, id, d)}
                  bumpAssists={(id, d) => bump(setAssists, id, d)}
                  bumpOwnGoals={(id, d) => bump(setOwnGoals, id, d)}
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
        <View
          style={[styles.validationBox, goalsMatchScore ? styles.validationBoxOk : styles.validationBoxErr]}
          {...(!goalsMatchScore ? { accessibilityRole: 'alert' as const } : {})}
          accessibilityLabel={
            goalsMatchScore
              ? `Doğrulama: Maç skoru ${totalFromScore} gol etkinliği, gol ve KK toplamı ${totalGoalEvents}, takım bazında uyumlu.`
              : `Uyarı: Gol/KK dağılımı maç skoruyla uyumsuz. Maç skoru ${totalFromScore} gol; gol+KK etkinliği ${totalGoalEvents}.`
          }
          testID="postmatch:validation:summary"
        >
          <Text style={styles.validationTitle}>Doğrulama özeti</Text>
          <Text style={styles.validationCounts}>
            Maç skoru: {totalFromScore} gol · Gol + KK etkinliği: {totalGoalEvents}
          </Text>
          {goalsMatchScore ? (
            <Text style={styles.validationOk}>Skor ile gol/KK dağılımı uyumlu.</Text>
          ) : (
            <Text style={styles.validationWarn}>
              Takım bazında gol ve KK, maç skoruyla eşleşmiyor (KK rakip takımın skoruna yazar).
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

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  sectionHead: { ...typography.subtitle, color: colors.text },
  roBody: { ...typography.body, color: colors.textMuted },
  scoreBlock: { gap: 0, marginBottom: spacing.sm },
  teamScoreLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  teamDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  teamLbl: { ...typography.caption, color: colors.textMuted, flex: 1, minWidth: 0, marginRight: spacing.sm },
  bigScore: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 0 },
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
  quickSectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  quickHint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  teamSectionHead: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyTeam: { ...typography.caption, color: colors.textMuted, paddingVertical: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  name: { ...typography.body, color: colors.text, flex: 1, minWidth: 0 },
  statsPair: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, flexShrink: 1, flexWrap: 'wrap', justifyContent: 'flex-end' },
  statsTripleWrap: { maxWidth: '100%' },
  statCluster: { alignItems: 'center', gap: spacing.xs },
  statLabel: { ...typography.micro, color: colors.textMuted },
  stepSmall: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stepCompact: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTxtSmall: { fontSize: 20, color: colors.text, fontFamily: 'Inter_600SemiBold' },
  ct: { ...typography.subtitle, color: colors.text, minWidth: 24, textAlign: 'center' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: spacing.md,
    paddingVertical: spacing.sm,
  },
  toggleLabel: { ...typography.body, color: colors.text, flex: 1, marginRight: spacing.md },
  validationBox: {
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    gap: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
  },
  validationBoxOk: {
    borderColor: colors.border,
  },
  validationBoxErr: {
    borderColor: colors.danger,
  },
  validationTitle: { ...typography.subtitle, color: colors.text },
  validationCounts: { ...typography.body, color: colors.textMuted },
  validationOk: { ...typography.caption, color: colors.textMuted },
  validationWarn: { ...typography.caption, color: colors.danger, fontFamily: 'Inter_600SemiBold' },
});
