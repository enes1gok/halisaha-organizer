import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Match, RSVPStatus } from '../types/domain';
import { shadows, spacing, typography } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { formatMatchDateTime } from '../utils/dates';
import { MatchHeroVenueTitle } from './MatchHeroVenueTitle';
import { PressableScale } from './PressableScale';
import { rsvpStatusIcon, rsvpStatusLeftBorder } from './rsvpUserIndicator';

type Props = {
  match: Match;
  goingCount: number;
  /** Kullanıcının RSVP durumu; yoksa sol kenar nötr kalır. */
  userRsvp?: RSVPStatus | null;
  onPress: () => void;
};

const RSVP_LABEL: Record<RSVPStatus, string> = {
  going: 'katılıyorsun',
  maybe: 'belki',
  notGoing: 'katılmıyorsun',
};

export function MatchCard({ match, goingCount, userRsvp, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const borderExtra = userRsvp ? rsvpStatusLeftBorder(userRsvp, colors) : undefined;
  const icon = userRsvp ? rsvpStatusIcon(userRsvp, colors) : null;

  const venueLabel = match.venue?.trim() ? match.venue : 'Halısaha';
  const dateLabel = formatMatchDateTime(match.startsAt);
  const rsvpPart = userRsvp ? `, ${RSVP_LABEL[userRsvp]}` : '';
  const a11yLabel = `${venueLabel}, ${dateLabel}, ${goingCount} bölü ${match.maxPlayers} oyuncu${rsvpPart}`;

  return (
    <PressableScale
      onPress={onPress}
      style={[styles.wrap, borderExtra]}
      android_ripple={{ color: colors.accentMuted }}
      testID={`match:card:${match.id}`}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint="Maç detayını aç"
    >
      <View style={styles.row}>
        {icon ? (
          <View style={styles.rsvpIconWrap} importantForAccessibility="no" accessibilityElementsHidden>
            <Ionicons name={icon.name} size={18} color={icon.color} />
          </View>
        ) : null}
        <View style={styles.main}>
          <MatchHeroVenueTitle venue={match.venue} variant="list" />
          <Text style={[typography.caption, styles.date]}>{dateLabel}</Text>
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

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    wrap: {
      backgroundColor: t.colors.surfaceGlass,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.glassBorder,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderLeftWidth: 4,
      borderLeftColor: 'transparent',
      ...shadows.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    rsvpIconWrap: {
      marginRight: -spacing.xs,
      justifyContent: 'center',
    },
    main: {
      flex: 1,
    },
    date: {
      color: t.colors.textMuted,
      marginTop: 4,
    },
    slot: {
      backgroundColor: t.colors.accentMuted,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.accent,
    },
    slotTxt: {
      color: t.colors.accent,
    },
  }),
);
