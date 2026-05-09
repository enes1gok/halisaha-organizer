import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { Match } from '../types/domain';
import { colors, shadows, spacing, typography } from '../theme';
import { formatMatchDateTime } from '../utils/dates';
import {
  matchHeroDateSharedTag,
  matchHeroSharedTransition,
  matchHeroVenueSharedTag,
} from '../utils/matchHeroSharedTransition';
import { MatchHeroVenueTitle } from './MatchHeroVenueTitle';
import { PressableScale } from './PressableScale';

type Props = {
  match: Match;
  goingCount: number;
  userGoing?: boolean;
  onPress: () => void;
};

export function MatchCard({ match, goingCount, userGoing, onPress }: Props) {
  return (
    <PressableScale
      onPress={onPress}
      style={[styles.wrap, userGoing && styles.going]}
      android_ripple={{ color: colors.accentMuted }}
    >
      <View style={styles.row}>
        <View style={styles.main}>
          <MatchHeroVenueTitle
            venue={match.venue}
            variant="list"
            sharedTransitionTag={matchHeroVenueSharedTag(match.id)}
            sharedTransitionStyle={matchHeroSharedTransition}
          />
          <Animated.View
            sharedTransitionTag={matchHeroDateSharedTag(match.id)}
            sharedTransitionStyle={matchHeroSharedTransition}
          >
            <Text style={[typography.caption, styles.date]}>
              {formatMatchDateTime(match.startsAt)}
            </Text>
          </Animated.View>
        </View>
        <View style={styles.slot}>
          <Text style={[typography.subtitle, styles.slotTxt]}>
            {goingCount}/{match.maxPlayers}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surfaceGlass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
    ...shadows.sm,
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
  date: {
    color: colors.textMuted,
    marginTop: 4,
  },
  slot: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  slotTxt: {
    color: colors.accent,
  },
});
