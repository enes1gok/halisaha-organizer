import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PillButton } from './PillButton';
import { PlayerAvatar } from './PlayerAvatar';
import { MotmSelectorSection } from './MotmSelectorSection';
import { QuickSelectPlayerRow, toScoreLines } from './PostMatchScoreForm';
import {
  goalsTotalFillsScore,
  goalsTotalMatchesScore,
  totalGoalsFromStatMap,
} from '../utils/postMatchScoreValidation';
import { QUICK_RATING_BANDS } from '../utils/matchPeerRatingQuickBands';
import { TEAM_SIDE_LABELS } from '../constants/teamLabels';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography } from '../theme';
import type { Match, MatchScoreVoteTally, Player } from '../types/domain';
import { useMatchesStore, usePlayersStore } from '../store';
import { useUserFeedback } from '../utils/userFeedback';
import { sortPeersByMatchContribution } from '../utils/matchPlayerContribution';

export type PostMatchInlineWizardHandle = {
  save: () => Promise<void>;
};

export type PostMatchInlineWizardProps = {
  match: Match;
  canManageMatch: boolean;
  currentUserId: string;
  onCompleted: () => void;
  /** Düzenleme modunda rating adımını gizler ve statlines kaydedince onCompleted çağırır. */
  hideRating?: boolean;
  /** Her iki bölümü aynı anda açık gösterir; kayıt işlemi forwardRef üzerinden tetiklenir. */
  editMode?: boolean;
};

type WizardStep = 'score' | 'statlines' | 'rating';

const EMPTY_TALLIES: import('../types/domain').MatchScoreVoteTally[] = [];

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    container: { gap: spacing.sm },
    stepCard: {
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      overflow: 'hidden',
      ...{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
    },
    stepCardActive: {
      borderColor: t.colors.accent,
    },
    stepCardCompleted: { opacity: 0.75 },
    stepCardLocked: { opacity: 0.45 },
    stepCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
    },
    stepIconCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepIconCircleActive: { backgroundColor: t.colors.accent },
    stepIconCircleCompleted: {
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.accent,
    },
    stepIconCircleLocked: {
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    stepIconText: { ...typography.subtitle, color: t.colors.textOnAccent },
    stepIconCheckmark: { color: t.colors.accent },
    stepHeaderMeta: { flex: 1 },
    stepTitle: { ...typography.subtitle, color: t.colors.text },
    stepSummary: { ...typography.caption, color: t.colors.textMuted, marginTop: spacing.xs },
    stepContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    scoreBlock: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    teamCard: {
      flex: 1,
      borderRadius: radius.card,
      padding: spacing.md,
      alignItems: 'center',
      gap: spacing.sm,
    },
    teamCardBlack: {
      backgroundColor: '#111111',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 10,
      elevation: 8,
    },
    teamCardWhite: {
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.08)',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 6,
    },
    teamLabel: { ...typography.caption, textAlign: 'center' },
    teamLabelBlack: { color: 'rgba(255,255,255,0.55)' },
    teamLabelWhite: { color: 'rgba(0,0,0,0.45)' },
    teamDivider: { width: '100%', height: StyleSheet.hairlineWidth },
    teamDividerBlack: { backgroundColor: 'rgba(255,255,255,0.12)' },
    teamDividerWhite: { backgroundColor: 'rgba(0,0,0,0.1)' },
    scoreCtrl: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    scoreBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    scoreBtnBlack: {
      borderColor: 'rgba(255,255,255,0.2)',
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    scoreBtnWhite: {
      borderColor: 'rgba(0,0,0,0.12)',
      backgroundColor: 'rgba(0,0,0,0.05)',
    },
    scoreTxt: {
      fontSize: 44,
      fontFamily: 'Inter_700Bold',
      minWidth: 52,
      textAlign: 'center',
    },
    scoreTxtBlack: { color: '#FFFFFF' },
    scoreTxtWhite: { color: '#111111' },
    scoreBtnTxt: {
      fontSize: 22,
      fontFamily: 'Inter_600SemiBold',
    },
    scoreBtnTxtBlack: { color: '#FFFFFF' },
    scoreBtnTxtWhite: { color: '#111111' },
    sectionTitle: {
      ...typography.subtitle,
      color: t.colors.text,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    validationBox: {
      padding: spacing.md,
      borderRadius: radius.sm,
      backgroundColor: t.colors.surface,
      gap: spacing.xs,
      borderWidth: StyleSheet.hairlineWidth,
      marginVertical: spacing.md,
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
    validationWarn: {
      ...typography.caption,
      color: t.colors.danger,
      fontFamily: 'Inter_600SemiBold',
    },
    waitingContainer: {
      minHeight: 100,
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.md,
    },
    waitingText: { ...typography.body, color: t.colors.textMuted, textAlign: 'center' },
    tallyHint: {
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: spacing.sm,
      paddingVertical: 8,
      marginBottom: spacing.sm,
      alignItems: 'center',
    },
    tallyHintText: { ...typography.caption, fontWeight: '600' },
    stepFooter: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      paddingTop: spacing.sm,
    },
    ratingSection: {
      marginBottom: spacing.lg,
    },
    ratingPlayerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    playerInfo: {
      flex: 1,
      minWidth: 0,
    },
    playerName: { ...typography.body, color: t.colors.text },
    ratingChips: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginTop: spacing.xs,
      flexWrap: 'wrap',
    },
    chip: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    chipOn: {
      backgroundColor: t.colors.accentMuted,
      borderColor: t.colors.accent,
    },
    chipTxt: { ...typography.micro, color: t.colors.text },
    chipTxtOn: { color: t.colors.accent, fontFamily: 'Inter_600SemiBold' },
    motmSection: {
      marginTop: spacing.lg,
      paddingTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
    },
    motmTitle: { ...typography.subtitle, color: t.colors.text, marginBottom: spacing.md },
  })
);

function getInitialStep(match: Match, hideRating?: boolean): WizardStep {
  if (!match.result) return 'score';
  if (hideRating) return 'score';
  const goalsMap = Object.fromEntries(
    match.result.scorers.map((s) => [s.playerId, s.count])
  );
  if (goalsTotalFillsScore(match.result.scoreA, match.result.scoreB, goalsMap)) {
    return 'rating';
  }
  return 'statlines';
}

function ScoreStepContent({
  match,
  canManageMatch,
  scoreA,
  scoreB,
  onScoreAChange,
  onScoreBChange,
  leadingTally,
}: {
  match: Match;
  canManageMatch: boolean;
  scoreA: number;
  scoreB: number;
  onScoreAChange: (v: number) => void;
  onScoreBChange: (v: number) => void;
  leadingTally?: MatchScoreVoteTally;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  if (!canManageMatch) {
    return (
      <View style={[styles.stepContent, styles.waitingContainer]}>
        <ActivityIndicator size="small" />
        <Text style={styles.waitingText}>Organizatör sonucu giriyor…</Text>
      </View>
    );
  }

  return (
    <View style={styles.stepContent}>
      {leadingTally != null && (
        <Pressable
          style={[
            styles.tallyHint,
            { backgroundColor: colors.accentMuted, borderColor: colors.accent },
          ]}
          onPress={() => {
            onScoreAChange(leadingTally.scoreA);
            onScoreBChange(leadingTally.scoreB);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${leadingTally.voterCount} kişi ${leadingTally.scoreA}-${leadingTally.scoreB} önerdi. Uygula.`}
        >
          <Text style={[styles.tallyHintText, { color: colors.accent }]}>
            {leadingTally.voterCount} kişi {leadingTally.scoreA}–{leadingTally.scoreB} önerdi · Uygula
          </Text>
        </Pressable>
      )}
      <View style={styles.scoreBlock}>
        <View style={[styles.teamCard, styles.teamCardBlack]}>
          <Text style={[styles.teamLabel, styles.teamLabelBlack]}>
            {TEAM_SIDE_LABELS.A}
          </Text>
          <View style={[styles.teamDivider, styles.teamDividerBlack]} />
          <View style={styles.scoreCtrl}>
            <Pressable
              onPress={() => onScoreAChange(Math.max(0, scoreA - 1))}
              style={[styles.scoreBtn, styles.scoreBtnBlack]}
            >
              <Text style={[styles.scoreBtnTxt, styles.scoreBtnTxtBlack]}>−</Text>
            </Pressable>
            <Text style={[styles.scoreTxt, styles.scoreTxtBlack]}>{scoreA}</Text>
            <Pressable
              onPress={() => onScoreAChange(scoreA + 1)}
              style={[styles.scoreBtn, styles.scoreBtnBlack]}
            >
              <Text style={[styles.scoreBtnTxt, styles.scoreBtnTxtBlack]}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.teamCard, styles.teamCardWhite]}>
          <Text style={[styles.teamLabel, styles.teamLabelWhite]}>
            {TEAM_SIDE_LABELS.B}
          </Text>
          <View style={[styles.teamDivider, styles.teamDividerWhite]} />
          <View style={styles.scoreCtrl}>
            <Pressable
              onPress={() => onScoreBChange(Math.max(0, scoreB - 1))}
              style={[styles.scoreBtn, styles.scoreBtnWhite]}
            >
              <Text style={[styles.scoreBtnTxt, styles.scoreBtnTxtWhite]}>−</Text>
            </Pressable>
            <Text style={[styles.scoreTxt, styles.scoreTxtWhite]}>{scoreB}</Text>
            <Pressable
              onPress={() => onScoreBChange(scoreB + 1)}
              style={[styles.scoreBtn, styles.scoreBtnWhite]}
            >
              <Text style={[styles.scoreBtnTxt, styles.scoreBtnTxtWhite]}>+</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function StatLinesStepContent({
  match,
  canManageMatch,
  goals,
  assists,
  onBumpGoals,
  onBumpAssists,
  submitting,
  currentUserId,
  onSaveOwnEntry,
  goalEntries,
  currentScoreA,
  currentScoreB,
  scrollable = true,
}: {
  match: Match;
  canManageMatch: boolean;
  goals: Record<string, number>;
  assists: Record<string, number>;
  onBumpGoals: (id: string, delta: number) => void;
  onBumpAssists: (id: string, delta: number) => void;
  submitting: boolean;
  currentUserId: string;
  onSaveOwnEntry: () => void;
  goalEntries: import('../types/domain').MatchGoalEntry[];
  currentScoreA?: number;
  currentScoreB?: number;
  scrollable?: boolean;
}) {
  const styles = useStyles();
  const getPlayer = usePlayersStore((s) => s.getPlayer);

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

  const effectiveScoreA = currentScoreA ?? match.result?.scoreA ?? 0;
  const effectiveScoreB = currentScoreB ?? match.result?.scoreB ?? 0;
  const totalGoals = totalGoalsFromStatMap(goals);
  const totalScore = effectiveScoreA + effectiveScoreB;
  const goalsExceedScore = totalGoals > totalScore;
  const goalsFillScore = goalsTotalFillsScore(effectiveScoreA, effectiveScoreB, goals);

  const inner = canManageMatch ? (
    <>
      <Text style={styles.sectionTitle}>Gol ve Asist</Text>
      <Text style={[styles.sectionTitle, { fontSize: 13, marginTop: spacing.xs }]}>
        {TEAM_SIDE_LABELS.A}
      </Text>
      {teamAPlayers.length === 0 ? (
        <Text style={[styles.waitingText, { fontSize: 13 }]}>Kadroda oyuncu yok.</Text>
      ) : (
        teamAPlayers.map((p) => (
          <QuickSelectPlayerRow
            key={p.id}
            player={p}
            segment="teamA"
            goals={goals}
            assists={assists}
            bumpGoals={onBumpGoals}
            bumpAssists={onBumpAssists}
          />
        ))
      )}

      <Text style={[styles.sectionTitle, { fontSize: 13 }]}>
        {TEAM_SIDE_LABELS.B}
      </Text>
      {teamBPlayers.length === 0 ? (
        <Text style={[styles.waitingText, { fontSize: 13 }]}>Kadroda oyuncu yok.</Text>
      ) : (
        teamBPlayers.map((p) => (
          <QuickSelectPlayerRow
            key={p.id}
            player={p}
            segment="teamB"
            goals={goals}
            assists={assists}
            bumpGoals={onBumpGoals}
            bumpAssists={onBumpAssists}
          />
        ))
      )}

      {unassignedPlayers.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { fontSize: 13 }]}>Takım atanmamış</Text>
          {unassignedPlayers.map((p) => (
            <QuickSelectPlayerRow
              key={p.id}
              player={p}
              segment="unassigned"
              goals={goals}
              assists={assists}
              bumpGoals={onBumpGoals}
              bumpAssists={onBumpAssists}
            />
          ))}
        </>
      )}

      <View
        style={[
          styles.validationBox,
          goalsExceedScore ? styles.validationBoxErr : styles.validationBoxOk,
        ]}
      >
        <Text style={styles.validationTitle}>Doğrulama</Text>
        <Text style={styles.validationCounts}>
          Maç skoru: {effectiveScoreA} + {effectiveScoreB} ={' '}
          {totalScore} gol
        </Text>
        <Text style={styles.validationCounts}>
          Gol etkinliği: {totalGoals} gol
        </Text>
        {goalsExceedScore ? (
          <Text style={styles.validationWarn}>
            Gol sayısı skoru aşıyor.
          </Text>
        ) : goalsFillScore ? (
          <Text style={styles.validationOk}>Tüm goller atfedildi.</Text>
        ) : (
          <Text style={styles.validationOk}>
            Uyumlu ({totalScore - totalGoals} gol atfedilmemiş).
          </Text>
        )}
      </View>
      <View style={{ height: spacing.lg }} />
    </>
  ) : (
    <>
      <Text style={styles.sectionTitle}>Kendi Gollerini Gir</Text>

      {/* Kendi satırı — düzenlenebilir */}
      <QuickSelectPlayerRow
        key={currentUserId}
        player={getPlayer(currentUserId) ?? { id: currentUserId, name: 'Sen', position: 'MID', preferredFoot: 'right', stats: { matchesPlayed: 0, goals: 0, assists: 0, wins: 0, losses: 0, draws: 0 } }}
        segment="teamA"
        goals={goals}
        assists={assists}
        bumpGoals={onBumpGoals}
        bumpAssists={onBumpAssists}
      />
      <PillButton
        title={submitting ? 'Kaydediliyor…' : 'Kaydet'}
        onPress={onSaveOwnEntry}
        disabled={submitting}
        style={{ marginTop: spacing.sm }}
      />

      {/* Diğer oyuncuların kayıtlı girişleri — sadece görüntüle */}
      {goalEntries.filter((e) => e.playerId !== currentUserId && (e.goals > 0 || e.assists > 0)).length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Diğer Girişler</Text>
          {goalEntries
            .filter((e) => e.playerId !== currentUserId && (e.goals > 0 || e.assists > 0))
            .map((e) => (
              <View
                key={e.playerId}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs }}
              >
                <PlayerAvatar name={getPlayer(e.playerId)?.name ?? '?'} uri={getPlayer(e.playerId)?.photoUri} size={28} />
                <Text style={[styles.waitingText, { flex: 1, fontSize: 13 }]}>
                  {getPlayer(e.playerId)?.name ?? 'Oyuncu'}
                  {e.goals > 0 ? `  ⚽ ×${e.goals}` : ''}
                  {e.assists > 0 ? `  🅰 ×${e.assists}` : ''}
                </Text>
                <Text style={[styles.validationOk, { fontSize: 11 }]}>Kaydedildi</Text>
              </View>
            ))}
        </>
      )}

      <View style={{ height: spacing.lg }} />
    </>
  );

  if (!scrollable) {
    return <View style={styles.stepContent}>{inner}</View>;
  }
  return <ScrollView style={styles.stepContent} showsVerticalScrollIndicator>{inner}</ScrollView>;
}

function RatingStepContent({
  match,
  currentUserId,
  ratings,
  motmId,
  onRatingChange,
  onMotmSelect,
  submitting,
}: {
  match: Match;
  currentUserId: string;
  ratings: Record<string, number>;
  motmId: string | null;
  onRatingChange: (playerId: string, score: number) => void;
  onMotmSelect: (playerId: string) => void;
  submitting: boolean;
}) {
  const styles = useStyles();
  const getPlayer = usePlayersStore((s) => s.getPlayer);

  const peers = useMemo(() => {
    const ids = new Set<string>();
    match.teamAIds.forEach((id) => ids.add(id));
    match.teamBIds.forEach((id) => ids.add(id));
    ids.delete(currentUserId);
    const peerObjs = Array.from(ids)
      .map((id) => {
        const p = getPlayer(id);
        return p ? { id, p } : null;
      })
      .filter((x): x is { id: string; p: Player } => x !== null);
    return sortPeersByMatchContribution(
      match,
      peerObjs,
      (x) => x.p.name
    );
  }, [match, currentUserId, getPlayer]);

  return (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={true}>
      <Text style={styles.sectionTitle}>Oyuncuları Derecelendir</Text>

      {peers.length === 0 ? (
        <Text style={styles.waitingText}>Değerlendirilecek oyuncu yok.</Text>
      ) : (
        <View style={styles.ratingSection}>
          {peers.map((p) => (
            <View key={p.id} style={styles.ratingPlayerRow}>
              <PlayerAvatar name={p.p.name} uri={p.p.photoUri} size={32} />
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{p.p.name}</Text>
                <View style={styles.ratingChips}>
                  {QUICK_RATING_BANDS.map((band) => {
                    const isSelected = ratings[p.id] === band.score;
                    return (
                      <Pressable
                        key={band.id}
                        onPress={() => onRatingChange(p.id, band.score)}
                        style={[
                          styles.chip,
                          isSelected && styles.chipOn,
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipTxt,
                            isSelected && styles.chipTxtOn,
                          ]}
                        >
                          {band.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {peers.length > 0 && (
        <View style={styles.motmSection}>
          <Text style={styles.motmTitle}>Maçın Adamı</Text>
          <MotmSelectorSection
            match={match}
            choices={peers}
            selectedId={motmId}
            onSelect={onMotmSelect}
          />
        </View>
      )}

      <View style={{ height: spacing.lg }} />
    </ScrollView>
  );
}

export const PostMatchInlineWizard = React.forwardRef<
  PostMatchInlineWizardHandle,
  PostMatchInlineWizardProps
>(function PostMatchInlineWizard({
  match,
  canManageMatch,
  currentUserId,
  onCompleted,
  hideRating,
  editMode,
}, ref) {
  const styles = useStyles();
  const submitScore = useMatchesStore((s) => s.submitScore);
  const updateMatchResultOrganizer = useMatchesStore((s) => s.updateMatchResultOrganizer);
  const submitMatchRatings = useMatchesStore((s) => s.submitMatchRatings);
  const hasSubmittedRatings = useMatchesStore(
    (s) => !!s.matchRatingsSubmissionByMatchId[match.id],
  );
  const fetchGoalEntries = useMatchesStore((s) => s.fetchGoalEntries);
  const saveGoalEntry = useMatchesStore((s) => s.saveGoalEntry);
  const goalEntries = useMatchesStore(
    (s) => s.goalEntriesByMatchId[match.id] ?? [],
  );
  const fetchScoreVoteTally = useMatchesStore((s) => s.fetchScoreVoteTally);
  const scoreVoteTallies = useMatchesStore(
    (s) => s.scoreVoteTalliesByMatchId[match.id] ?? EMPTY_TALLIES,
  );
  const { showUserFacingError } = useUserFeedback();

  const leadingTally = scoreVoteTallies[0];

  const [step, setStep] = useState<WizardStep>(() => getInitialStep(match, hideRating));
  const [scoreA, setScoreA] = useState(() => match.result?.scoreA ?? 0);
  const [scoreB, setScoreB] = useState(() => match.result?.scoreB ?? 0);
  const [goals, setGoals] = useState<Record<string, number>>(() => {
    const g: Record<string, number> = {};
    if (match.result) {
      match.result.scorers.forEach((l) => {
        g[l.playerId] = l.count;
      });
    }
    return g;
  });
  const [assists, setAssists] = useState<Record<string, number>>(() => {
    const a: Record<string, number> = {};
    if (match.result) {
      match.result.assists.forEach((l) => {
        a[l.playerId] = l.count;
      });
    }
    return a;
  });
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [motmId, setMotmId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleEditModeSave = useCallback(async () => {
    setSubmitting(true);
    try {
      const result = {
        scoreA,
        scoreB,
        scorers: toScoreLines(goals),
        assists: toScoreLines(assists),
        ownGoals: match.result?.ownGoals ?? [],
      };
      if (match.result) {
        await updateMatchResultOrganizer(match.id, result);
      } else {
        await submitScore(match.id, result);
      }
      onCompleted();
    } catch (e) {
      showUserFacingError(e, {
        uiOperation: 'PostMatchInlineWizard.editModeSave',
        fallbackMessage: 'Sonuç kaydedilemedi.',
        mapOperation: 'submitMatchResultRpc',
      });
    } finally {
      setSubmitting(false);
    }
  }, [scoreA, scoreB, goals, assists, match, updateMatchResultOrganizer, submitScore, onCompleted, showUserFacingError]);

  useImperativeHandle(ref, () => ({ save: handleEditModeSave }), [handleEditModeSave]);

  const ratingWindowOpen = useMemo(() => {
    if (!match.ratingWindowEndsAt) return false;
    return new Date(match.ratingWindowEndsAt).getTime() > Date.now();
  }, [match.ratingWindowEndsAt]);

  useEffect(() => {
    if (canManageMatch) void fetchScoreVoteTally(match.id);
    void fetchGoalEntries(match.id);
    // Zustand aksiyonları stabil referans — deps'e gerek yok
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id, canManageMatch]);

  useEffect(() => {
    setStep(getInitialStep(match, hideRating));
    setScoreA(match.result?.scoreA ?? 0);
    setScoreB(match.result?.scoreB ?? 0);
    const g: Record<string, number> = {};
    const a: Record<string, number> = {};
    if (match.result) {
      match.result.scorers.forEach((l) => {
        g[l.playerId] = l.count;
      });
      match.result.assists.forEach((l) => {
        a[l.playerId] = l.count;
      });
    }
    setGoals(g);
    setAssists(a);
    setRatings({});
    setMotmId(null);
  }, [match]);

  const handleSubmitScore = async () => {
    setSubmitting(true);
    try {
      const result = {
        scoreA,
        scoreB,
        scorers: toScoreLines(goals),
        assists: toScoreLines(assists),
        ownGoals: match.result?.ownGoals ?? [],
      };
      // İlk gönderimde submitScore (rating penceresi açılır),
      // düzenleme modunda updateMatchResultOrganizer (pencere sıfırlanmaz).
      if (match.result) {
        await updateMatchResultOrganizer(match.id, result);
      } else {
        await submitScore(match.id, result);
      }
      setStep('statlines');
    } catch (e) {
      showUserFacingError(e, {
        uiOperation: 'PostMatchInlineWizard.submitScore',
        fallbackMessage: 'Skor kaydedilemedi.',
        mapOperation: 'submitMatchResultRpc',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitStatLines = async () => {
    if (!match.result) return;
    setSubmitting(true);
    try {
      const result = {
        scoreA: match.result.scoreA,
        scoreB: match.result.scoreB,
        scorers: toScoreLines(goals),
        assists: toScoreLines(assists),
        ownGoals: match.result.ownGoals ?? [],
      };
      await updateMatchResultOrganizer(match.id, result);
      if (hideRating) {
        onCompleted();
      } else {
        setStep('rating');
      }
    } catch (e) {
      showUserFacingError(e, {
        uiOperation: 'PostMatchInlineWizard.submitStatLines',
        fallbackMessage: 'Gol ve asistler kaydedilemedi.',
        mapOperation: 'submitMatchResultRpc',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitRatings = async () => {
    setSubmitting(true);
    try {
      if (!motmId) {
        showUserFacingError(new Error('MOTM seçilmedi'), {
          uiOperation: 'PostMatchInlineWizard.submitRatings',
          fallbackMessage: 'Maçın adamını seçin.',
        });
        setSubmitting(false);
        return;
      }
      const ratingInputs = Object.entries(ratings).map(([ratee_id, score]) => ({
        ratee_id,
        score,
      }));
      await submitMatchRatings(match.id, ratingInputs, motmId);
      onCompleted();
    } catch (e) {
      showUserFacingError(e, {
        uiOperation: 'PostMatchInlineWizard.submitRatings',
        fallbackMessage: 'Puanlama kaydedilemedi.',
        mapOperation: 'submitMatchRatingsBundleRemote',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveOwnEntry = async () => {
    setSubmitting(true);
    try {
      await saveGoalEntry(match.id, goals[currentUserId] ?? 0, assists[currentUserId] ?? 0);
    } catch (e) {
      showUserFacingError(e, {
        uiOperation: 'PostMatchInlineWizard.saveGoalEntry',
        fallbackMessage: 'Gol girişi kaydedilemedi.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (editMode) {
    const bumpGoals = (id: string, delta: number) => {
      setGoals((prev) => {
        const next = { ...prev };
        const v = (next[id] ?? 0) + delta;
        if (v <= 0) delete next[id];
        else next[id] = v;
        return next;
      });
    };
    const bumpAssists = (id: string, delta: number) => {
      setAssists((prev) => {
        const next = { ...prev };
        const v = (next[id] ?? 0) + delta;
        if (v <= 0) delete next[id];
        else next[id] = v;
        return next;
      });
    };

    return (
      <View style={styles.container}>
        <ScoreStepContent
          match={match}
          canManageMatch={canManageMatch}
          scoreA={scoreA}
          scoreB={scoreB}
          onScoreAChange={setScoreA}
          onScoreBChange={setScoreB}
          leadingTally={leadingTally}
        />
        <StatLinesStepContent
          match={match}
          canManageMatch={canManageMatch}
          goals={goals}
          assists={assists}
          onBumpGoals={bumpGoals}
          onBumpAssists={bumpAssists}
          submitting={submitting}
          currentUserId={currentUserId}
          onSaveOwnEntry={handleSaveOwnEntry}
          goalEntries={goalEntries}
          currentScoreA={scoreA}
          currentScoreB={scoreB}
          scrollable={false}
        />
      </View>
    );
  }

  const scoreStepSummary = match.result
    ? `${match.result.scoreA} – ${match.result.scoreB}`
    : 'Beklemede';

  const statLinesStepSummary =
    match.result && (match.result.scorers.length > 0 || match.result.assists.length > 0)
      ? `${match.result.scorers.length + match.result.assists.length} etkinlik`
      : 'Beklemede';

  return (
    <View style={styles.container}>
      {/* Score Step Card */}
      <View
        style={[
          styles.stepCard,
          step === 'score' && styles.stepCardActive,
          step === 'score' && match.result ? styles.stepCardCompleted : undefined,
          step !== 'score' && !match.result ? styles.stepCardLocked : undefined,
        ]}
      >
        <Pressable
          style={styles.stepCardHeader}
          onPress={() => {
            if (canManageMatch && match.result && step !== 'score') setStep('score');
          }}
          disabled={!(canManageMatch && match.result && step !== 'score')}
        >
          <View
            style={[
              styles.stepIconCircle,
              step === 'score' && styles.stepIconCircleActive,
              step === 'score' && match.result ? styles.stepIconCircleCompleted : undefined,
              step !== 'score' && !match.result ? styles.stepIconCircleLocked : undefined,
            ]}
          >
            {match.result ? (
              <Ionicons
                name="checkmark"
                size={18}
                style={styles.stepIconCheckmark}
              />
            ) : (
              <Text style={styles.stepIconText}>1</Text>
            )}
          </View>
          <View style={styles.stepHeaderMeta}>
            <Text style={styles.stepTitle}>Skor</Text>
            {match.result && (
              <Text style={styles.stepSummary}>{scoreStepSummary}</Text>
            )}
          </View>
        </Pressable>

        {step === 'score' && (
          <>
            <ScoreStepContent
              match={match}
              canManageMatch={canManageMatch}
              scoreA={scoreA}
              scoreB={scoreB}
              onScoreAChange={setScoreA}
              onScoreBChange={setScoreB}
              leadingTally={leadingTally}
            />
            {canManageMatch && (
              <View style={styles.stepFooter}>
                <PillButton
                  title="Skoru Gönder"
                  onPress={handleSubmitScore}
                  disabled={submitting}
                  style={{ flex: 1 }}
                />
              </View>
            )}
            {!canManageMatch && (
              <View style={styles.stepFooter}>
                <PillButton
                  title="Daha Sonra"
                  variant="ghost"
                  onPress={onCompleted}
                  style={{ flex: 1 }}
                />
              </View>
            )}
          </>
        )}
      </View>

      {/* StatLines Step Card */}
      <View
        style={[
          styles.stepCard,
          step === 'statlines' && styles.stepCardActive,
          step === 'statlines' && match.result && goalsTotalFillsScore(match.result.scoreA, match.result.scoreB, goals)
            ? styles.stepCardCompleted
            : undefined,
          step !== 'statlines' && !match.result
            ? styles.stepCardLocked
            : undefined,
        ]}
      >
        <Pressable
          style={styles.stepCardHeader}
          onPress={() => {
            if (canManageMatch && match.result && step !== 'statlines') setStep('statlines');
          }}
          disabled={!(canManageMatch && match.result && step !== 'statlines')}
        >
          <View
            style={[
              styles.stepIconCircle,
              step === 'statlines' && styles.stepIconCircleActive,
              step === 'statlines' &&
              match.result &&
              goalsTotalFillsScore(match.result.scoreA, match.result.scoreB, goals)
                ? styles.stepIconCircleCompleted
                : undefined,
              step !== 'statlines' && !match.result
                ? styles.stepIconCircleLocked
                : undefined,
            ]}
          >
            {step === 'statlines' &&
            match.result &&
            goalsTotalFillsScore(
              match.result.scoreA,
              match.result.scoreB,
              goals
            ) ? (
              <Ionicons
                name="checkmark"
                size={18}
                style={styles.stepIconCheckmark}
              />
            ) : (
              <Text style={styles.stepIconText}>2</Text>
            )}
          </View>
          <View style={styles.stepHeaderMeta}>
            <Text style={styles.stepTitle}>Detaylar</Text>
            {match.result && (
              <Text style={styles.stepSummary}>{statLinesStepSummary}</Text>
            )}
          </View>
        </Pressable>

        {step === 'statlines' && (
          <>
            <StatLinesStepContent
              match={match}
              canManageMatch={canManageMatch}
              goals={goals}
              assists={assists}
              onBumpGoals={(id, d) => {
                setGoals((prev) => {
                  const next = { ...prev };
                  const v = (next[id] ?? 0) + d;
                  if (v <= 0) delete next[id];
                  else next[id] = v;
                  return next;
                });
              }}
              onBumpAssists={(id, d) => {
                setAssists((prev) => {
                  const next = { ...prev };
                  const v = (next[id] ?? 0) + d;
                  if (v <= 0) delete next[id];
                  else next[id] = v;
                  return next;
                });
              }}
              submitting={submitting}
              currentUserId={currentUserId}
              onSaveOwnEntry={handleSaveOwnEntry}
              goalEntries={goalEntries}
            />
            {canManageMatch ? (
              <View style={styles.stepFooter}>
                <PillButton
                  title="Kaydet"
                  onPress={handleSubmitStatLines}
                  disabled={
                    submitting ||
                    !match.result ||
                    totalGoalsFromStatMap(goals) > match.result.scoreA + match.result.scoreB
                  }
                  style={{ flex: 1 }}
                />
              </View>
            ) : (
              <View style={styles.stepFooter}>
                <Text style={[styles.waitingText, { flex: 1, fontSize: 12 }]}>
                  Gol girişi tamamlandığında otomatik ilerler
                </Text>
                <PillButton
                  title="Geç →"
                  variant="ghost"
                  onPress={() => setStep('rating')}
                  disabled={submitting}
                />
              </View>
            )}
          </>
        )}
      </View>

      {/* Rating Step Card */}
      {!hideRating && <View
        style={[
          styles.stepCard,
          step === 'rating' && !hasSubmittedRatings && ratingWindowOpen && styles.stepCardActive,
          hasSubmittedRatings ? styles.stepCardCompleted : undefined,
          (step !== 'rating' || !ratingWindowOpen) && !hasSubmittedRatings ? styles.stepCardLocked : undefined,
        ]}
      >
        <Pressable
          style={styles.stepCardHeader}
          disabled
          onPress={undefined}
        >
          <View
            style={[
              styles.stepIconCircle,
              step === 'rating' && !hasSubmittedRatings && ratingWindowOpen && styles.stepIconCircleActive,
              hasSubmittedRatings ? styles.stepIconCircleCompleted : undefined,
              (step !== 'rating' || !ratingWindowOpen) && !hasSubmittedRatings ? styles.stepIconCircleLocked : undefined,
            ]}
          >
            {hasSubmittedRatings ? (
              <Ionicons name="checkmark" size={18} style={styles.stepIconCheckmark} />
            ) : !ratingWindowOpen ? (
              <Ionicons name="lock-closed" size={14} style={styles.stepIconCheckmark} />
            ) : (
              <Text style={styles.stepIconText}>3</Text>
            )}
          </View>
          <View style={styles.stepHeaderMeta}>
            <Text style={styles.stepTitle}>Değerlendir</Text>
            {!hasSubmittedRatings && !ratingWindowOpen && (
              <Text style={styles.stepSummary}>Süre doldu</Text>
            )}
          </View>
        </Pressable>

        {step === 'rating' && !hasSubmittedRatings && ratingWindowOpen && (() => {
          const ids = new Set<string>();
          match.teamAIds.forEach((id) => ids.add(id));
          match.teamBIds.forEach((id) => ids.add(id));
          ids.delete(currentUserId);
          const peersCount = ids.size;
          const canComplete = peersCount === 0 || motmId !== null;

          return (
            <>
              <RatingStepContent
                match={match}
                currentUserId={currentUserId}
                ratings={ratings}
                motmId={motmId}
                onRatingChange={(playerId, score) => {
                  setRatings((prev) => ({ ...prev, [playerId]: score }));
                }}
                onMotmSelect={setMotmId}
                submitting={submitting}
              />
              <View style={styles.stepFooter}>
                <PillButton
                  title="Geç"
                  variant="ghost"
                  onPress={onCompleted}
                  disabled={submitting}
                  style={{ flex: 1 }}
                />
                <PillButton
                  title="Tamamla"
                  onPress={handleSubmitRatings}
                  disabled={submitting || !canComplete}
                  style={{ flex: 1 }}
                />
              </View>
            </>
          );
        })()}
      </View>}
    </View>
  );
});
