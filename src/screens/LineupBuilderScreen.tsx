import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { TEAM_SIDE_LABELS } from '../constants/teamLabels';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { PillButton } from '../components/PillButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { PositionBadge } from '../components/PositionBadge';
import { colors, radius, spacing, typography } from '../theme';
import type { Player, Position } from '../types/domain';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore, useMatchesStore, usePlayersStore } from '../store';
import type { HomeStackParamList, MyMatchesStackParamList } from '../navigation/types';

type Route =
  | RouteProp<HomeStackParamList, 'LineupBuilder'>
  | RouteProp<MyMatchesStackParamList, 'LineupBuilder'>;
type Nav = StackNavigationProp<HomeStackParamList & MyMatchesStackParamList>;

type Rect = { x: number; y: number; w: number; h: number };

const LONG_PRESS_MS = 300;
const DRAG_SCALE = 1.03;

function arraysShallowEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function autoBalance(players: Player[]): { A: string[]; B: string[] } {
  const buckets: Record<Position, Player[]> = {
    GK: [],
    DEF: [],
    MID: [],
    FWD: [],
  };
  for (const p of players) buckets[p.position].push(p);
  const teamA: string[] = [];
  const teamB: string[] = [];
  const keys: Position[] = ['GK', 'DEF', 'MID', 'FWD'];
  for (const k of keys) {
    const list = buckets[k];
    list.forEach((p, i) => {
      if (i % 2 === 0) teamA.push(p.id);
      else teamB.push(p.id);
    });
  }
  return { A: teamA, B: teamB };
}

/** Katılacak her oyuncuyu iki takımdan birine yerleştirir; RSVP düşenleri çıkarır, eksikleri autoBalance ile ekler. */
function syncTeamsWithGoing(
  teamAIds: string[],
  teamBIds: string[],
  goingPlayers: Player[],
): { A: string[]; B: string[] } {
  const goingIds = new Set(goingPlayers.map((p) => p.id));
  let nextA = teamAIds.filter((id) => goingIds.has(id));
  let nextB = teamBIds.filter((id) => goingIds.has(id));
  const assigned = new Set([...nextA, ...nextB]);
  const missing = goingPlayers.filter((p) => !assigned.has(p.id));
  if (missing.length === 0) {
    return { A: nextA, B: nextB };
  }
  const { A: addA, B: addB } = autoBalance(missing);
  return { A: [...nextA, ...addA], B: [...nextB, ...addB] };
}

function DraggableCard({
  player,
  onDragEnd,
  testID,
}: {
  player: Player;
  onDragEnd: (id: string, x: number, y: number) => void;
  testID: string;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const dragging = useSharedValue(0);

  const pan = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_MS)
    .onUpdate((e) => {
      dragging.value = 1;
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e) => {
      runOnJS(onDragEnd)(player.id, e.absoluteX, e.absoluteY);
      tx.value = withSpring(0);
      ty.value = withSpring(0);
      dragging.value = withSpring(0);
    })
    .onFinalize(() => {
      tx.value = withSpring(0);
      ty.value = withSpring(0);
      dragging.value = withSpring(0);
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      {
        scale: interpolate(dragging.value, [0, 1], [1, DRAG_SCALE], Extrapolation.CLAMP),
      },
    ],
    zIndex: dragging.value ? 10 : 1,
    elevation: dragging.value ? 8 : 2,
    shadowOpacity: dragging.value ? 0.35 : 0,
    shadowRadius: dragging.value ? 10 : 0,
    shadowOffset: { width: 0, height: dragging.value ? 4 : 0 },
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[styles.card, style]}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={player.name}
        accessibilityHint="Takımlar arası taşımak için basılı tutup sürükleyin."
      >
        <PlayerAvatar name={player.name} uri={player.photoUri} size={36} />
        <View style={styles.cardMeta}>
          <Text style={styles.cardName} numberOfLines={1}>
            {player.name}
          </Text>
          <PositionBadge position={player.position} />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export function LineupBuilderScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { matchId } = route.params;

  const userId = useAuthStore((s) => s.getCurrentUserId());
  const getPlayer = usePlayersStore((s) => s.getPlayer);
  const playersAll = usePlayersStore((s) => s.players);
  const { match, setMatchTeams, lockLineup } = useMatchesStore(
    useShallow((s) => ({
      match: s.getMatch(matchId),
      setMatchTeams: s.setMatchTeams,
      lockLineup: s.lockLineup,
    })),
  );

  const [confirmOpen, setConfirmOpen] = useState(false);

  const zoneA = useRef<View>(null);
  const zoneB = useRef<View>(null);
  const rects = useRef<{ A?: Rect; B?: Rect }>({});

  const measure = useCallback(() => {
    const cb =
      (key: keyof typeof rects.current) =>
      (x: number, y: number, w: number, h: number) => {
        rects.current[key] = { x, y, w, h };
      };
    zoneA.current?.measureInWindow(cb('A'));
    zoneB.current?.measureInWindow(cb('B'));
  }, []);

  useEffect(() => {
    const t = setTimeout(measure, 300);
    return () => clearTimeout(t);
  }, [match?.teamAIds, match?.teamBIds, measure]);

  const goingPlayers = useMemo(() => {
    if (!match) return [];
    const goingIds = new Set(
      match.attendees.filter((a) => a.status === 'going').map((a) => a.playerId),
    );
    return playersAll.filter((p) => goingIds.has(p.id));
  }, [match, playersAll]);

  const [teamAIds, setTeamAIds] = useState<string[]>([]);
  const [teamBIds, setTeamBIds] = useState<string[]>([]);

  useEffect(() => {
    if (!match) return;
    if (match.lineupLocked) {
      navigation.goBack();
      return;
    }
    setTeamAIds(match.teamAIds.length ? match.teamAIds : []);
    setTeamBIds(match.teamBIds.length ? match.teamBIds : []);
  }, [match, navigation]);

  useEffect(() => {
    if (!match) return;
    if (match.organizerId !== userId) {
      navigation.goBack();
    }
  }, [match, navigation, userId]);

  useEffect(() => {
    if (!match || match.lineupLocked) return;
    const synced = syncTeamsWithGoing(teamAIds, teamBIds, goingPlayers);
    if (arraysShallowEqual(synced.A, teamAIds) && arraysShallowEqual(synced.B, teamBIds)) {
      return;
    }
    setTeamAIds(synced.A);
    setTeamBIds(synced.B);
    void setMatchTeams(match.id, synced.A, synced.B).catch((err) =>
      Alert.alert('Hata', err instanceof Error ? err.message : 'Kadro kaydedilemedi.'),
    );
  }, [match, goingPlayers, teamAIds, teamBIds, setMatchTeams]);

  const handleDrop = (playerId: string, absX: number, absY: number) => {
    const inside = (r: Rect | undefined) =>
      r &&
      absX >= r.x &&
      absX <= r.x + r.w &&
      absY >= r.y &&
      absY <= r.y + r.h;

    let nextA = teamAIds.filter((id) => id !== playerId);
    let nextB = teamBIds.filter((id) => id !== playerId);

    if (inside(rects.current.A)) nextA = [...nextA, playerId];
    else if (inside(rects.current.B)) nextB = [...nextB, playerId];
    else return;

    setTeamAIds(nextA);
    setTeamBIds(nextB);
    if (match) {
      void setMatchTeams(match.id, nextA, nextB).catch((err) =>
        Alert.alert('Hata', err instanceof Error ? err.message : 'Kadro kaydedilemedi.'),
      );
    }
    setTimeout(measure, 50);
  };

  const onBalance = () => {
    const { A, B } = autoBalance(goingPlayers);
    setTeamAIds(A);
    setTeamBIds(B);
    if (match) {
      void setMatchTeams(match.id, A, B).catch((err) =>
        Alert.alert('Hata', err instanceof Error ? err.message : 'Kadro kaydedilemedi.'),
      );
    }
    setTimeout(measure, 50);
  };

  const onLayoutZone = (_e: LayoutChangeEvent) => {
    measure();
  };

  const confirmLineup = async () => {
    setConfirmOpen(false);
    if (match) {
      try {
        await lockLineup(match.id);
      } catch (err) {
        Alert.alert('Hata', err instanceof Error ? err.message : 'Kilitlenemedi.');
        return;
      }
    }
    navigation.goBack();
  };

  if (!match) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Maç yok</Text>
      </View>
    );
  }

  const renderCol = (
    ids: string[],
    zoneRef: React.RefObject<View | null>,
    title: string,
    side: 'a' | 'b',
  ) => (
    <View ref={zoneRef} style={styles.zone} onLayout={onLayoutZone}>
      <Text style={styles.zoneTitle}>{title}</Text>
      <ScrollView
        nestedScrollEnabled
        testID={`lineup:team-${side}:scroll`}
        keyboardShouldPersistTaps="handled"
      >
        {ids.map((id) => {
          const p = getPlayer(id);
          if (!p) return null;
          return (
            <DraggableCard
              key={id}
              player={p}
              onDragEnd={handleDrop}
              testID={`lineup:player-card:${id}`}
            />
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.screen}>
      <Text style={styles.hint} accessibilityRole="text">
        Listeleri kaydırmak için kaydırın. Takımlar arası taşımak için oyuncuya basılı tutup
        sürükleyin.
      </Text>

      <View style={styles.row}>
        {renderCol(teamAIds, zoneA, TEAM_SIDE_LABELS.A, 'a')}
        {renderCol(teamBIds, zoneB, TEAM_SIDE_LABELS.B, 'b')}
      </View>

      <View style={styles.actions}>
        <PillButton title="Otomatik Denge" variant="ghost" onPress={onBalance} />
        <PillButton title="Kadroyu Onayla" onPress={() => setConfirmOpen(true)} />
      </View>

      <ConfirmationModal
        visible={confirmOpen}
        title="Kadroyu kilitle?"
        message="Tüm oyunculara kadro bildirilecek. Bu işlem geri alınamaz."
        confirmLabel="Onayla"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirmLineup}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    gap: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    flex: 1,
  },
  zone: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    maxHeight: 420,
  },
  zoneTitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    shadowColor: '#000',
  },
  cardName: {
    ...typography.body,
    color: colors.text,
  },
  cardMeta: {
    flex: 1,
  },
  emptyText: {
    color: colors.textMuted,
  },
  actions: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
});
