import React from 'react';
import { Text, View } from 'react-native';
import { MatchHeroVenueTitle } from '../../../components/MatchHeroVenueTitle';
import { formatMatchDateTime } from '../../../utils/dates';
import type { Match } from '../../../types/domain';
import { matchDetailStyles as styles } from '../matchDetailStyles';

type Props = {
  match: Match;
  countdownLabel: string;
};

export function MatchDetailHero({ match, countdownLabel }: Props) {
  return (
    <View style={styles.hero}>
      <MatchHeroVenueTitle venue={match.venue} variant="detail" />
      <Text style={styles.heroDate}>{formatMatchDateTime(match.startsAt)}</Text>
      <Text style={[styles.heroCd, match.status === 'cancelled' && styles.heroCdCancelled]}>
        {match.status === 'upcoming'
          ? countdownLabel
          : match.status === 'cancelled'
            ? 'Maç İptal Edildi'
            : 'Maç Bitti'}
      </Text>
      {match.status === 'cancelled' ? (
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
