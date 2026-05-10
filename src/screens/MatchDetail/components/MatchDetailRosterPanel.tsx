import React from 'react';
import { Text, View } from 'react-native';
import { PlayerAvatar } from '../../../components/PlayerAvatar';
import { PositionBadge } from '../../../components/PositionBadge';
import type { Attendee, Match, Player } from '../../../types/domain';
import { matchDetailStyles as styles } from '../matchDetailStyles';

type Props = {
  match: Match;
  attendeesSorted: { a: Attendee; p: Player }[];
  motmWinnerIds: Set<string>;
  ratingByPid: Map<string, { avg: number | null; votes_count: number }>;
};

export function MatchDetailRosterPanel({
  match,
  attendeesSorted,
  motmWinnerIds,
  ratingByPid,
}: Props) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Oyuncular</Text>
      {attendeesSorted.map(({ a, p }) => {
        const inMatchLineup =
          match.teamAIds.includes(a.playerId) || match.teamBIds.includes(a.playerId);
        const rr = inMatchLineup ? ratingByPid.get(a.playerId) : undefined;
        return (
          <View key={a.playerId} style={styles.playerRow}>
            <PlayerAvatar name={p!.name} uri={p!.photoUri} showPaid={a.paid} />
            <View style={styles.playerMeta}>
              <Text style={styles.playerName}>{p!.name}</Text>
              <View style={styles.badgesRow}>
                <PositionBadge position={p!.position} />
                {match.status === 'finished' && inMatchLineup && motmWinnerIds.has(a.playerId) ? (
                  <View style={styles.motmBadge}>
                    <Text style={styles.motmBadgeTxt}>Maçın adamı</Text>
                  </View>
                ) : null}
              </View>
              {match.status === 'finished' && inMatchLineup ? (
                <Text style={styles.micro}>
                  Oy ort.:{' '}
                  {rr && rr.votes_count > 0 && rr.avg != null ? `${rr.avg.toFixed(1)} / 100` : '—'}
                </Text>
              ) : null}
            </View>
            <Text style={styles.micro} accessibilityLabel={a.paid ? 'Ödendi' : 'Ödenmedi'}>
              {a.paid ? 'Ödendi' : 'Ödenmedi'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
