import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Match } from '../types/domain';
import { colors, spacing, typography } from '../theme';
import { formatMatchDateTime } from '../utils/dates';

type Props = {
  match: Match;
  goingCount: number;
  userGoing?: boolean;
  onPress: () => void;
};

export function MatchCard({ match, goingCount, userGoing, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.wrap, userGoing && styles.going]}
      android_ripple={{ color: colors.accentMuted }}
    >
      <View style={styles.row}>
        <View style={styles.main}>
          <Text style={[typography.subtitle, styles.venue]} numberOfLines={1}>
            {match.venue}
          </Text>
          <Text style={[typography.caption, styles.date]}>
            {formatMatchDateTime(match.startsAt)}
          </Text>
        </View>
        <View style={styles.slot}>
          <Text style={[typography.subtitle, styles.slotTxt]}>
            {goingCount}/{match.maxPlayers}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  going: {
    borderLeftColor: colors.accent,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  main: {
    flex: 1,
  },
  venue: {
    color: colors.text,
  },
  date: {
    color: colors.textMuted,
    marginTop: 4,
  },
  slot: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 12,
  },
  slotTxt: {
    color: colors.accent,
  },
});
