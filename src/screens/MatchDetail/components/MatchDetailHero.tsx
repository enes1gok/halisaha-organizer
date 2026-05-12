import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { LayoutAnimation, Text, View } from 'react-native';
import { MatchHeroVenueTitle } from '../../../components/MatchHeroVenueTitle';
import { PressableScale } from '../../../components/PressableScale';
import { useTheme } from '../../../theme/ThemeContext';
import type { Match, RSVPStatus } from '../../../types/domain';
import { formatMatchDateTime } from '../../../utils/dates';
import type { EffectiveStatus } from '../../../utils/matchEffectiveStatus';
import { useMatchDetailStyles } from '../matchDetailStyles';

type Props = {
  match: Match;
  countdownLabel: string;
  effectiveStatus: EffectiveStatus;
  currentUserRsvp: RSVPStatus | null;
  onPressRsvp: () => void;
};

function heroCountdownLabel(
  effectiveStatus: EffectiveStatus,
  countdownLabel: string,
): string {
  switch (effectiveStatus) {
    case 'upcoming': return countdownLabel;
    case 'ongoing': return 'Devam Ediyor';
    case 'finished': return 'Maç Bitti';
    case 'cancelled': return 'Maç İptal Edildi';
  }
}

export function MatchDetailHero({
  match,
  countdownLabel,
  effectiveStatus,
  currentUserRsvp,
  onPressRsvp,
}: Props) {
  const { colors } = useTheme();
  const styles = useMatchDetailStyles();

  React.useEffect(() => {
    if (effectiveStatus === 'ongoing') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  }, [effectiveStatus]);

  const rsvpInfo = React.useMemo(() => {
    if (!currentUserRsvp) {
      return {
        label: 'Katıl',
        icon: 'add-circle-outline',
        bg: colors.surfaceSoft,
        content: colors.text,
        border: colors.border,
      };
    }
    if (currentUserRsvp === 'going') {
      return {
        label: 'Gidiyorum',
        icon: 'checkmark-circle',
        bg: colors.accent,
        content: colors.textOnAccent,
        border: colors.accent,
      };
    }
    if (currentUserRsvp === 'maybe') {
      return {
        label: 'Belki',
        icon: 'help-circle',
        bg: colors.text,
        content: colors.background,
        border: colors.text,
      };
    }
    return {
      label: 'Gelmiyorum',
      icon: 'close-circle',
      bg: colors.danger,
      content: colors.textOnAccent,
      border: colors.danger,
    };
  }, [currentUserRsvp, colors]);

  const isOngoing = effectiveStatus === 'ongoing';

  return (
    <View style={styles.hero}>
      <View style={styles.heroHeader}>
        <View style={styles.heroMain}>
          <MatchHeroVenueTitle venue={match.venue} variant="detail" />
          <Text style={styles.heroDate}>{formatMatchDateTime(match.startsAt)}</Text>
        </View>

        <PressableScale
          style={[
            styles.heroRsvp,
            {
              backgroundColor: rsvpInfo.bg,
              borderColor: rsvpInfo.border,
            },
          ]}
          onPress={isOngoing ? undefined : onPressRsvp}
          disabled={isOngoing}
        >
          <Ionicons name={rsvpInfo.icon as any} size={18} color={rsvpInfo.content} />
          <Text style={[styles.heroRsvpText, { color: rsvpInfo.content }]}>
            {rsvpInfo.label}
          </Text>
        </PressableScale>
      </View>

      <Text
        style={[
          styles.heroCd,
          effectiveStatus === 'cancelled' && styles.heroCdCancelled,
        ]}
      >
        {heroCountdownLabel(effectiveStatus, countdownLabel)}
      </Text>
      {effectiveStatus === 'ongoing' ? (
        <View style={styles.ongoingBadge} accessibilityRole="text" accessibilityLabel="Maç başladı">
          <Text style={styles.ongoingBadgeTxt}>BAŞLADI</Text>
        </View>
      ) : null}
      {effectiveStatus === 'cancelled' ? (
        <View style={styles.cancelBadge} accessibilityRole="text" accessibilityLabel="Maç iptal edildi">
          <Text style={styles.cancelBadgeTxt}>İPTAL EDİLDİ</Text>
        </View>
      ) : null}
      {match.status === 'finished' && match.result ? (
        <Text style={styles.heroScore}>
          Skor: {match.result.scoreA} – {match.result.scoreB}
        </Text>
      ) : null}
    </View>
  );
}
