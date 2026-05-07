import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PillButton } from '../components/PillButton';
import { PostMatchScoreForm } from '../components/PostMatchScoreForm';
import { TAB_BAR_LIST_PADDING_BOTTOM } from '../navigation/tabBarLayout';
import type { GroupsStackParamList, HomeStackParamList, MyMatchesStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';
import { formatMatchDateTime } from '../utils/dates';
import { isRemoteMatchId } from '../utils/matchId';
import { useAuthStore, useMatchesStore } from '../store';

type Stacks = HomeStackParamList & MyMatchesStackParamList & GroupsStackParamList;
type R =
  | RouteProp<HomeStackParamList, 'MatchPostgame'>
  | RouteProp<MyMatchesStackParamList, 'MatchPostgame'>
  | RouteProp<GroupsStackParamList, 'MatchPostgame'>;
type Nav = StackNavigationProp<Stacks>;

export function MatchPostgameScreen() {
  const route = useRoute<R>();
  const navigation = useNavigation<Nav>();
  const { matchId } = route.params;

  const userId = useAuthStore((s) => s.getCurrentUserId());
  const match = useMatchesStore((s) => s.getMatch(matchId));

  const isOrg = match?.organizerId === userId;
  const lineup = useMemo(
    () =>
      match ? match.teamAIds.includes(userId) || match.teamBIds.includes(userId) : false,
    [match, userId],
  );

  const isRemote = match ? isRemoteMatchId(match.id) : false;
  const canEditScore = Boolean(match && ((isRemote && (lineup || isOrg)) || (!isRemote && isOrg)));
  const showSelfReportToggle = Boolean(isOrg);

  const showRatingsCta =
    !!match?.result && lineup && match.status === 'finished' && isRemote;

  if (!match) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textMuted }}>Maç bulunamadı</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_LIST_PADDING_BOTTOM }]}
    >
      <Text style={styles.heroVenue}>{match.venue}</Text>
      <Text style={styles.heroDate}>{formatMatchDateTime(match.startsAt)}</Text>
      <Text style={styles.lead}>Skoru kadrodaki oyuncular veya organizatör girebilir. Son gönderilen skor geçerlidir.</Text>

      <PostMatchScoreForm
        match={match}
        canEditScore={canEditScore}
        showSelfReportToggle={showSelfReportToggle}
      />

      {showRatingsCta ? (
        <>
          <Text style={[styles.section, styles.mt]}>Oyuncular</Text>
          <Text style={styles.muted}>Maçın adamı seçip takım arkadaşlarını derecelendirebilirsiniz.</Text>
          <PillButton
            title="Oyuncuları derecelendir"
            variant="ghost"
            onPress={() => navigation.navigate('MatchRatings', { matchId: match.id })}
            testID="postgame:ratings:press"
            style={styles.mt}
          />
        </>
      ) : null}

      <PillButton title="Maç kartı özeti" variant="ghost" onPress={() => navigation.navigate('MatchSummary', { matchId })} style={styles.mt} />
      <PillButton title="Tüm detaylar" variant="ghost" onPress={() => navigation.navigate('MatchDetail', { matchId })} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.sm },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroVenue: { ...typography.title, color: colors.text },
  heroDate: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs },
  lead: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 18 },
  section: { ...typography.subtitle, color: colors.text },
  muted: { ...typography.caption, color: colors.textMuted },
  mt: { marginTop: spacing.md },
});
