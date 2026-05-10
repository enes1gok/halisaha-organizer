import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from './Card';
import { MatchHeroVenueTitle } from './MatchHeroVenueTitle';
import { colors, letterSpacing, spacing, typography } from '../theme';
import type { Match, Player } from '../types/domain';
import { formatMatchDateTime } from '../utils/dates';

export type MatchFinishedResultCardProps = {
  match: Match;
  getPlayer: (id: string) => Player | undefined;
  /** Kadrodaki kullanıcı için özet RPC'den gelen ortalama */
  myRatingAvg?: number | null;
};

export const MatchFinishedResultCard = React.forwardRef<View, MatchFinishedResultCardProps>(
  function MatchFinishedResultCard({ match, getPlayer, myRatingAvg }, ref) {
    const result = match.result;

    return (
      <View ref={ref} collapsable={false} style={styles.captureRoot}>
        <Card style={styles.card}>
          <MatchHeroVenueTitle venue={match.venue} variant="list" numberOfLines={2} testID="match-summary:venue" />
          <Text style={styles.date}>{formatMatchDateTime(match.startsAt)}</Text>

          {result ? (
            <>
              <View style={styles.scoreHero}>
                <Text style={styles.teamTag}>A</Text>
                <Text style={styles.scoreBig} testID="match-summary:scoreA">
                  {result.scoreA}
                </Text>
                <Text style={styles.scoreSep}>–</Text>
                <Text style={styles.scoreBig} testID="match-summary:scoreB">
                  {result.scoreB}
                </Text>
                <Text style={styles.teamTag}>B</Text>
              </View>

              {result.scorers.length === 0 &&
              result.assists.length === 0 &&
              (result.ownGoals ?? []).length === 0 ? (
                <Text style={styles.muted}>Oyuncu bazlı gol kaydı yok.</Text>
              ) : (
                <View style={styles.detailBlock}>
                  <Text style={styles.sectionLbl}>Skor detayı</Text>
                  {result.scorers.map((l) => (
                    <Text key={`g-${l.playerId}`} style={styles.body}>
                      {getPlayer(l.playerId)?.name ?? 'Oyuncu'} — Gol ×{l.count}
                    </Text>
                  ))}
                  {(result.ownGoals ?? []).map((l) => (
                    <Text key={`og-${l.playerId}`} style={styles.body}>
                      {getPlayer(l.playerId)?.name ?? 'Oyuncu'} — KK ×{l.count}
                    </Text>
                  ))}
                  {result.assists.map((l) => (
                    <Text key={`a-${l.playerId}`} style={styles.body}>
                      {getPlayer(l.playerId)?.name ?? 'Oyuncu'} — Asist ×{l.count}
                    </Text>
                  ))}
                </View>
              )}
            </>
          ) : (
            <Text style={styles.noResult}>Sonuç yok</Text>
          )}

          {myRatingAvg != null ? (
            <Text style={styles.myAvg}>Oy ortalamanız: {myRatingAvg.toFixed(1)} / 100</Text>
          ) : null}

          <Text style={styles.brandFoot}>Halısaha: Maç Organize Et</Text>
        </Card>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  captureRoot: {
    alignSelf: 'stretch',
  },
  card: {
    gap: spacing.sm,
  },
  date: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  scoreHero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  teamTag: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: letterSpacing.wide,
    minWidth: 16,
    textAlign: 'center',
  },
  scoreBig: {
    ...typography.headlineStrong,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  scoreSep: {
    ...typography.headlineStrong,
    color: colors.textMuted,
  },
  noResult: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  detailBlock: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  sectionLbl: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.normal,
    marginBottom: spacing.xs,
  },
  body: {
    ...typography.body,
    color: colors.text,
  },
  muted: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  myAvg: {
    ...typography.caption,
    color: colors.accent,
    marginTop: spacing.sm,
  },
  brandFoot: {
    ...typography.micro,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
    opacity: 0.85,
  },
});
