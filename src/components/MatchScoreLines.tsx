import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '../theme';
import { makeStyles } from '../theme/ThemeContext';
import type { Match, Player } from '../types/domain';

type Props = {
  match: Match;
  getPlayer: (id: string) => Player | undefined;
};

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    container: { gap: spacing.xs },
    line: { ...typography.body, color: t.colors.text },
    muted: { ...typography.caption, color: t.colors.textMuted },
  })
);

export function MatchScoreLines({ match, getPlayer }: Props) {
  const styles = useStyles();
  if (!match.result) return null;

  const { scorers, assists, ownGoals } = match.result;
  const hasLines =
    scorers.length > 0 || assists.length > 0 || (ownGoals ?? []).length > 0;

  if (!hasLines) {
    return <Text style={styles.muted}>Oyuncu bazlı gol kaydı yok.</Text>;
  }

  return (
    <View style={styles.container}>
      {scorers.map((l) => (
        <Text key={`g-${l.playerId}`} style={styles.line}>
          {getPlayer(l.playerId)?.name ?? 'Oyuncu'} — Gol ×{l.count}
        </Text>
      ))}
      {(ownGoals ?? []).map((l) => (
        <Text key={`og-${l.playerId}`} style={styles.line}>
          {getPlayer(l.playerId)?.name ?? 'Oyuncu'} — KK ×{l.count}
        </Text>
      ))}
      {assists.map((l) => (
        <Text key={`a-${l.playerId}`} style={styles.line}>
          {getPlayer(l.playerId)?.name ?? 'Oyuncu'} — Asist ×{l.count}
        </Text>
      ))}
    </View>
  );
}
