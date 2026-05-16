import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { MatchScoreVoteTally } from '../types/domain';

const EMPTY_TALLIES: MatchScoreVoteTally[] = [];
import { makeStyles } from '../theme/ThemeContext';
import { useMatchesStore } from '../store';
import { useUserFeedback } from '../utils/userFeedback';
import { spacing, typography } from '../theme';

interface Props {
  matchId: string;
  isOrganizer: boolean;
  canVote: boolean;
}

function leadingTally(tallies: MatchScoreVoteTally[]): MatchScoreVoteTally | undefined {
  return tallies[0];
}

function totalWeight(tallies: MatchScoreVoteTally[]): number {
  return tallies.reduce((sum, t) => sum + t.voteWeight, 0);
}

export function MatchScoreVoteCard({ matchId, isOrganizer, canVote }: Props) {
  const styles = useStyles();
  const { showApiErrorToast } = useUserFeedback();

  const tallies = useMatchesStore(
    (s) => s.scoreVoteTalliesByMatchId[matchId] ?? EMPTY_TALLIES,
  );
  const fetchScoreVoteTally = useMatchesStore((s) => s.fetchScoreVoteTally);
  const submitMatchScoreVote = useMatchesStore((s) => s.submitMatchScoreVote);

  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    setFetching(true);
    fetchScoreVoteTally(matchId).finally(() => setFetching(false));
    // fetchScoreVoteTally Zustand aksiyonu — stabil referans, deps'e gerek yok
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  const leading = leadingTally(tallies);
  const total = totalWeight(tallies);

  const handleSubmit = useCallback(async () => {
    const a = parseInt(scoreA, 10);
    const b = parseInt(scoreB, 10);
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0) return;
    setLoading(true);
    try {
      await submitMatchScoreVote(matchId, a, b);
      setScoreA('');
      setScoreB('');
    } catch (error) {
      showApiErrorToast(error, {
        uiOperation: 'match:scoreVote',
        fallbackMessage: 'Skor oyunuz kaydedilemedi.',
      });
    } finally {
      setLoading(false);
    }
  }, [matchId, scoreA, scoreB, submitMatchScoreVote, showApiErrorToast]);

  const isInputValid =
    scoreA.length > 0 &&
    scoreB.length > 0 &&
    !isNaN(parseInt(scoreA, 10)) &&
    !isNaN(parseInt(scoreB, 10));

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Skor Önerisi</Text>

      {fetching && tallies.length === 0 ? (
        <ActivityIndicator style={styles.loader} />
      ) : (
        <>
          {tallies.length > 0 && (
            <View style={styles.tallySection}>
              {tallies.map((t) => (
                <View key={`${t.scoreA}-${t.scoreB}`} style={styles.tallyRow}>
                  <View style={styles.tallyScoreContainer}>
                    <Text style={styles.tallyScore}>
                      {t.scoreA} – {t.scoreB}
                    </Text>
                    {t.scoreA === leading?.scoreA && t.scoreB === leading?.scoreB && (
                      <View style={styles.leadingBadge}>
                        <Text style={styles.leadingBadgeText}>Önerilen</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.tallyMeta}>
                    <View
                      style={[
                        styles.tallyBar,
                        { flex: total > 0 ? t.voteWeight / total : 0 },
                      ]}
                    />
                    <Text style={styles.tallyCount}>
                      {t.voterCount} oy
                      {isOrganizer ? ` · ${t.voteWeight} ağ.` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {tallies.length === 0 && (
            <Text style={styles.emptyText}>Henüz skor önerisi yok.</Text>
          )}
        </>
      )}

      {canVote && (
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>
            {isOrganizer ? 'Skor öner (2× ağırlık)' : 'Skor öner'}
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.scoreInput}
              value={scoreA}
              onChangeText={setScoreA}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="A"
              placeholderTextColor="#666"
              testID="scoreVote:scoreA:input"
              accessibilityLabel="A takımı skoru"
            />
            <Text style={styles.dash}>–</Text>
            <TextInput
              style={styles.scoreInput}
              value={scoreB}
              onChangeText={setScoreB}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="B"
              placeholderTextColor="#666"
              testID="scoreVote:scoreB:input"
              accessibilityLabel="B takımı skoru"
            />
            <TouchableOpacity
              style={[styles.submitButton, (!isInputValid || loading) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!isInputValid || loading}
              testID="scoreVote:submit:press"
              accessibilityRole="button"
              accessibilityLabel="Skor öner"
              hitSlop={4}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Gönder</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: 12,
      padding: spacing.md,
      marginHorizontal: spacing.md,
      marginVertical: spacing.sm,
      borderWidth: 1,
      borderColor: t.colors.border,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    title: {
      ...typography.subtitle,
      color: t.colors.text,
      marginBottom: spacing.sm,
    },
    loader: {
      marginVertical: spacing.sm,
    },
    tallySection: {
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    tallyRow: {
      gap: 4,
    },
    tallyScoreContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    tallyScore: {
      ...typography.body,
      color: t.colors.text,
      fontVariant: ['tabular-nums'],
    },
    leadingBadge: {
      backgroundColor: t.colors.accentMuted,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    leadingBadgeText: {
      ...typography.micro,
      color: t.colors.accent,
      fontWeight: '600',
    },
    tallyMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      height: 6,
    },
    tallyBar: {
      height: 6,
      backgroundColor: t.colors.accent,
      borderRadius: 3,
      minWidth: 4,
    },
    tallyCount: {
      ...typography.caption,
      color: t.colors.textMuted,
    },
    emptyText: {
      ...typography.caption,
      color: t.colors.textMuted,
      marginBottom: spacing.sm,
    },
    inputSection: {
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
      paddingTop: spacing.sm,
      marginTop: spacing.xs,
    },
    inputLabel: {
      ...typography.caption,
      color: t.colors.textMuted,
      marginBottom: 6,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    scoreInput: {
      width: 48,
      height: 44,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.background,
      color: t.colors.text,
      textAlign: 'center',
      fontSize: 18,
      fontWeight: '600',
    },
    dash: {
      ...typography.title,
      color: t.colors.textMuted,
    },
    submitButton: {
      flex: 1,
      height: 44,
      backgroundColor: t.colors.accent,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    submitButtonDisabled: {
      opacity: 0.45,
    },
    submitButtonText: {
      ...typography.body,
      color: '#fff',
      fontWeight: '600',
    },
  }),
);
