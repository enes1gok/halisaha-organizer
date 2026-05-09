import * as Clipboard from 'expo-clipboard';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import React, { useCallback } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { PillButton } from '../components/PillButton';
import { useClipboardCopyFeedback } from '../hooks/useClipboardCopyFeedback';
import { TAB_BAR_LIST_PADDING_BOTTOM } from '../navigation/tabBarLayout';
import type { GroupsStackParamList, HomeStackParamList, MyMatchesStackParamList } from '../navigation/types';
import { toUserMessage } from '../services/supabase/errors';
import { colors, letterSpacing, radius, shadows, spacing, typography } from '../theme';
import { formatMatchDateTime } from '../utils/dates';
import { countGoing, hasAssignedLineup } from '../utils/matchRoster';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore, useMatchesStore } from '../store';

type Stacks = HomeStackParamList & MyMatchesStackParamList & GroupsStackParamList;
type R =
  | RouteProp<HomeStackParamList, 'MatchPregame'>
  | RouteProp<MyMatchesStackParamList, 'MatchPregame'>
  | RouteProp<GroupsStackParamList, 'MatchPregame'>;
type Nav = StackNavigationProp<Stacks>;

function MatchPregameJoinCode({ joinCode }: { joinCode: string }) {
  const { label, runCopy, isCopied } = useClipboardCopyFeedback({
    idleLabel: `Kod ${joinCode}`,
    copiedLabel: 'Kod kopyalandı',
    copiedDurationMs: 3000,
  });

  const onPress = useCallback(() => {
    void runCopy(async () => {
      await Clipboard.setStringAsync(joinCode);
    });
  }, [joinCode, runCopy]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={isCopied ? 'Kod kopyalandı' : 'Katılım kodunu kopyala'}
      style={({ pressed }) => [styles.codeButton, pressed && styles.codeButtonPressed]}
      testID="pregame:join-code:copy"
    >
      <Text style={[styles.codeButtonLabel, isCopied && styles.codeButtonLabelCopied]}>{label}</Text>
    </Pressable>
  );
}

export function MatchPregameScreen() {
  const route = useRoute<R>();
  const navigation = useNavigation<Nav>();
  const { matchId } = route.params;

  const userId = useAuthStore((s) => s.getCurrentUserId());
  const { match, setRSVP, unlockLineup } = useMatchesStore(
    useShallow((s) => ({
      match: s.getMatch(matchId),
      setRSVP: s.setRSVP,
      unlockLineup: s.unlockLineup,
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
        <MatchPregameJoinCode joinCode={match.joinCode} />
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
          {match.lineupLocked && match.status === 'upcoming' ? (
            <PillButton
              title="Kilidi kaldır"
              variant="secondary"
              onPress={() =>
                Alert.alert(
                  'Kilidi kaldır?',
                  'Oyunculara bildirim gitmiş olabilir. Kadroyu yeniden düzenleyebilirsiniz; yeniden yayınladığınızda bildirim yeniden tetiklenebilir.',
                  [
                    { text: 'İptal', style: 'cancel' },
                    {
                      text: 'Kaldır',
                      style: 'destructive',
                      onPress: () =>
                        void unlockLineup(match.id).catch((e) =>
                          Alert.alert('Hata', toUserMessage(e, 'Kaydedilemedi.')),
                        ),
                    },
                  ],
                )
              }
              testID="pregame:lineup:unlock:press"
            />
          ) : null}
          {!match.lineupLocked && match.status === 'upcoming' ? (
            <PillButton
              title={hasAssignedLineup(match) ? 'Kadroyu düzenle' : 'Kadro Kur'}
              onPress={() => navigation.navigate('LineupBuilder', { matchId })}
              testID="pregame:lineup:press"
            />
          ) : null}
          {match.lineupLocked && match.status !== 'upcoming' ? (
            <Text style={styles.muted}>Kadro kilitli.</Text>
          ) : null}
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
  codeButton: {
    alignSelf: 'flex-start',
    minHeight: 48,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
    ...shadows.sm,
  },
  codeButtonPressed: {
    opacity: 0.88,
  },
  codeButtonLabel: {
    ...typography.subtitle,
    fontSize: 15,
    color: colors.accent,
    letterSpacing: letterSpacing.code,
  },
  codeButtonLabelCopied: {
    color: colors.copyFeedbackLight,
    letterSpacing: letterSpacing.normal,
  },
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
