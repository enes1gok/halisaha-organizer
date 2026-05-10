import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { MatchHeroVenueTitle } from './MatchHeroVenueTitle';
import { colors, radius, shadows, spacing, typography } from '../theme';
import type { Match } from '../types/domain';
import { formatMatchDateTime } from '../utils/dates';
import { getPlayerMatchOutcome } from '../utils/matchOutcome';

type Props = {
  match: Match;
  playerId: string;
  onPress: () => void;
};

const OUTCOME_COPY: Record<'W' | 'L' | 'D', { label: string; color: string }> = {
  W: { label: 'Galibiyet', color: colors.accent },
  L: { label: 'Mağlubiyet', color: colors.danger },
  D: { label: 'Beraberlik', color: colors.slate },
};

export function HomeLastMatchCard({ match, playerId, onPress }: Props) {
  const outcome = useMemo(() => getPlayerMatchOutcome(match, playerId), [match, playerId]);
  const result = match.result;

  if (!result || !outcome) return null;

  const oc = OUTCOME_COPY[outcome];

  return (
    <View style={styles.outer}>
      <PressableScale
        onPress={onPress}
        style={styles.card}
        android_ripple={{ color: colors.accentMuted }}
        testID="home:last-match:press"
        accessibilityRole="button"
        accessibilityLabel={`Son maç, ${oc.label}, ${match.venue}`}
      >
        <Text style={[typography.caption, styles.sectionLabel]}>Son maç</Text>
        <MatchHeroVenueTitle venue={match.venue} variant="list" />
        <Text style={[typography.caption, styles.date]}>{formatMatchDateTime(match.startsAt)}</Text>
        <View style={styles.scoreRow}>
          <Text style={[typography.headlineStrong, styles.score]} testID="home:last-match:score">
            {result.scoreA} — {result.scoreB}
          </Text>
          <View style={[styles.badge, { borderColor: oc.color }]}>
            <Text style={[typography.micro, styles.badgeTxt, { color: oc.color }]}>{oc.label}</Text>
          </View>
        </View>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: colors.surfaceGlass,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.md,
    ...shadows.sm,
  },
  sectionLabel: {
    color: colors.textMuted,
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  date: {
    color: colors.textMuted,
    marginTop: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  score: {
    color: colors.text,
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: colors.surfaceSoft,
  },
  badgeTxt: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
