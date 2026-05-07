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
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
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

function DraggableCard({
  player,
  onDragEnd,
}: {
  player: Player;
  onDragEnd: (id: string, x: number, y: number) => void;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const dragging = useSharedValue(0);

  const pan = Gesture.Pan()
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
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
    zIndex: dragging.value ? 10 : 1,
    elevation: dragging.value ? 6 : 1,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, style]}>
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
  const zoneBench = useRef<View>(null);
  const rects = useRef<{ A?: Rect; B?: Rect; Bench?: Rect }>({});

  const measure = useCallback(() => {
    const cb =
      (key: keyof typeof rects.current) =>
      (x: number, y: number, w: number, h: number) => {
        rects.current[key] = { x, y, w, h };
      };
    zoneA.current?.measureInWindow(cb('A'));
    zoneB.current?.measureInWindow(cb('B'));
    zoneBench.current?.measureInWindow(cb('Bench'));
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

  const benchIds = useMemo(() => {
    const set = new Set([...teamAIds, ...teamBIds]);
    return goingPlayers.map((p) => p.id).filter((id) => !set.has(id));
  }, [goingPlayers, teamAIds, teamBIds]);

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
    else if (inside(rects.current.Bench)) {
      /* yedek */
    } else {
      return;
    }

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

  const renderCol = (ids: string[], zoneRef: React.RefObject<View | null>, title: string) => (
    <View ref={zoneRef} style={styles.zone} onLayout={onLayoutZone}>
      <Text style={styles.zoneTitle}>{title}</Text>
      <ScrollView nestedScrollEnabled>
        {ids.map((id) => {
          const p = getPlayer(id);
          if (!p) return null;
          return <DraggableCard key={id} player={p} onDragEnd={handleDrop} />;
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.screen}>
      <Text style={styles.hint}>Oyuncuları sürükleyip takım alanına bırakın.</Text>
      <View ref={zoneBench} style={styles.bench} onLayout={onLayoutZone}>
        <Text style={styles.zoneTitle}>Yedek</Text>
        <ScrollView horizontal nestedScrollEnabled contentContainerStyle={styles.benchRow}>
          {benchIds.map((id) => {
            const p = getPlayer(id);
            if (!p) return null;
            return <DraggableCard key={id} player={p} onDragEnd={handleDrop} />;
          })}
        </ScrollView>
      </View>

      <View style={styles.row}>
        {renderCol(teamAIds, zoneA, 'Takım A')}
        {renderCol(teamBIds, zoneB, 'Takım B')}
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
  },
  bench: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    minHeight: 120,
  },
  benchRow: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
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
