import React from 'react';
import { LayoutAnimation, Text, View } from 'react-native';
import { MatchHeroVenueTitle } from '../../../components/MatchHeroVenueTitle';
import { formatMatchDateTime } from '../../../utils/dates';
import type { Match } from '../../../types/domain';
import type { EffectiveStatus } from '../../../utils/matchEffectiveStatus';
import { useMatchDetailStyles } from '../matchDetailStyles';

type Props = {
  match: Match;
  countdownLabel: string;
  effectiveStatus: EffectiveStatus;
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

export function MatchDetailHero({ match, countdownLabel, effectiveStatus }: Props) {
  const styles = useMatchDetailStyles();

  React.useEffect(() => {
    if (effectiveStatus === 'ongoing') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  }, [effectiveStatus]);

  return (
    <View style={styles.hero}>
      <MatchHeroVenueTitle venue={match.venue} variant="detail" />
      <Text style={styles.heroDate}>{formatMatchDateTime(match.startsAt)}</Text>
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
