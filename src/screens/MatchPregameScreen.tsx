import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { PillButton } from '../components/PillButton';
import { TAB_BAR_LIST_PADDING_BOTTOM } from '../navigation/tabBarLayout';
import type { GroupsStackParamList, HomeStackParamList, MyMatchesStackParamList } from '../navigation/types';
import { toUserMessage } from '../services/supabase/errors';
import { colors, letterSpacing, spacing, typography } from '../theme';
import { formatMatchDateTime } from '../utils/dates';
import { countGoing } from '../utils/matchRoster';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore, useMatchesStore } from '../store';

type Stacks = HomeStackParamList & MyMatchesStackParamList & GroupsStackParamList;
type R =
  | RouteProp<HomeStackParamList, 'MatchPregame'>
  | RouteProp<MyMatchesStackParamList, 'MatchPregame'>
  | RouteProp<GroupsStackParamList, 'MatchPregame'>;
type Nav = StackNavigationProp<Stacks>;

export function MatchPregameScreen() {
  const route = useRoute<R>();
  const navigation = useNavigation<Nav>();
  const { matchId } = route.params;

  const userId = useAuthStore((s) => s.getCurrentUserId());
  const { match, setRSVP } = useMatchesStore(
    useShallow((s) => ({
      match: s.getMatch(matchId),
      setRSVP: s.setRSVP,
    })),
  );

  const isOrg = match?.organizerId === userId;

  if (!match) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textMuted }}>Maç bulunamadı</Text>
      </View>
    );
  }

  const goingCount = countGoing(match);
  const attendee = match.attendees.find((a) => a.playerId === userId);
  const selfGoing = attendee?.status === 'going';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: TAB_BAR_LIST_PADDING_BOTTOM }}>
      <View style={styles.hero}>
        <Text style={styles.heroVenue}>{match.venue}</Text>
        <Text style={styles.heroDate}>{formatMatchDateTime(match.startsAt)}</Text>
        <Text style={styles.slot}>
          Oyuncular {goingCount}/{match.maxPlayers}
        </Text>
        <Text style={styles.code}>Kod {match.joinCode}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Katılım</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.body}>Bu maça gidiyorum</Text>
          <Switch
            value={selfGoing}
            onValueChange={(going) =>
              void setRSVP(match.id, userId, going ? 'going' : 'notGoing').catch((e) =>
                Alert.alert('Hata', toUserMessage(e, 'Kaydedilemedi.')),
              )
            }
            trackColor={{ false: colors.border, true: colors.accentMuted }}
            thumbColor={selfGoing ? colors.accent : colors.textMuted}
            testID="pregame:rsvp:toggle"
          />
        </View>
      </View>

      {isOrg ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Organizasyon</Text>
          {!match.lineupLocked ? (
            <PillButton
              title="Kadro Kur"
              onPress={() => navigation.navigate('LineupBuilder', { matchId })}
              testID="pregame:lineup:press"
            />
          ) : (
            <Text style={styles.muted}>Kadro kilitli.</Text>
          )}
        </View>
      ) : null}

      <View style={styles.pad}>
        <PillButton
          title="Tüm bilgiler (detay)"
          variant="ghost"
          onPress={() => navigation.navigate('MatchDetail', { matchId })}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  heroVenue: { ...typography.title, color: colors.text },
  heroDate: { ...typography.body, color: colors.textMuted },
  slot: { ...typography.subtitle, color: colors.accent, marginTop: spacing.xs },
  code: { ...typography.caption, color: colors.textMuted },
  section: { padding: spacing.md, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  pad: { padding: spacing.md },
  sectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.wide,
  },
  body: { ...typography.body, color: colors.text },
  muted: { ...typography.caption, color: colors.textMuted },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
