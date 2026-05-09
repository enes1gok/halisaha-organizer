import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
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
import {
  getLineupFormationById,
  getLineupFormationsForTotalPlayers,
  type LineupFormation,
  type LineupSlotDef,
} from '../data/lineupFormations';
import { FormationDropZone, type DropRect, type ZoneMap } from '../components/FormationDropZone';
import { PitchHalfField } from '../components/PitchHalfField';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { PillButton } from '../components/PillButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { PositionBadge } from '../components/PositionBadge';
import { colors, radius, spacing, typography } from '../theme';
import type { Player, Position } from '../types/domain';
import { buildSlotsFromCompact, compactSlots } from '../utils/lineupSlots';
import { hasAssignedLineup } from '../utils/matchRoster';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore, useMatchesStore, usePlayersStore } from '../store';
import type { GroupsStackParamList, HomeStackParamList, MyMatchesStackParamList } from '../navigation/types';

type Route =
  | RouteProp<HomeStackParamList, 'LineupBuilder'>
  | RouteProp<MyMatchesStackParamList, 'LineupBuilder'>
  | RouteProp<GroupsStackParamList, 'LineupBuilder'>;
type Nav = NativeStackNavigationProp<
  HomeStackParamList & MyMatchesStackParamList & GroupsStackParamList
>;

const LONG_PRESS_MS = 300;
const DRAG_SCALE = 1.03;

const FORMATION_TOTALS = new Set([14, 16, 22]);

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

function autoFillFormationSlots(players: Player[], formation: LineupFormation) {
  const sorted = [...players].sort((a, b) => {
    const order: Position[] = ['GK', 'DEF', 'MID', 'FWD'];
    return order.indexOf(a.position) - order.indexOf(b.position) || a.name.localeCompare(b.name);
  });
  const n = formation.playersPerTeam;
  const slotsA: (string | null)[] = Array.from({ length: n }, () => null);
  const slotsB: (string | null)[] = Array.from({ length: n }, () => null);
  sorted.forEach((p, i) => {
    const target = i % 2 === 0 ? slotsA : slotsB;
    const j = target.findIndex((x) => x == null);
    if (j >= 0) target[j] = p.id;
  });
  return { slotsA, slotsB };
}

function inside(r: DropRect | undefined, absX: number, absY: number): boolean {
  return !!(
    r &&
    absX >= r.x &&
    absX <= r.x + r.w &&
    absY >= r.y &&
    absY <= r.y + r.h
  );
}

function pickZone(zones: ZoneMap, absX: number, absY: number): string | null {
  for (const [key, r] of zones) {
    if (inside(r, absX, absY)) return key;
  }
  return null;
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
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        style={[styles.card, style]}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={player.name}
        accessibilityHint="Sürükleyerek sahaya veya havuza taşıyın."
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
  const rects = useRef<{ A?: DropRect; B?: DropRect }>({});

  const formationZonesRef = useRef<ZoneMap>(new Map());

  const { width: windowWidth } = useWindowDimensions();
  const stackHalfPitches = windowWidth < 420;

  const measure = useCallback(() => {
    const cb =
      (key: keyof typeof rects.current) =>
      (x: number, y: number, w: number, h: number) => {
        rects.current[key] = { x, y, w, h };
      };
    zoneA.current?.measureInWindow(cb('A'));
    zoneB.current?.measureInWindow(cb('B'));
  }, []);

  const goingPlayers = useMemo(() => {
    if (!match) return [];
    const goingIds = new Set(
      match.attendees.filter((a) => a.status === 'going').map((a) => a.playerId),
    );
    return playersAll.filter((p) => goingIds.has(p.id));
  }, [match, playersAll]);

  const formationMode = useMemo(
    () => FORMATION_TOTALS.has(goingPlayers.length),
    [goingPlayers.length],
  );

  const formationsForCount = useMemo(
    () => getLineupFormationsForTotalPlayers(goingPlayers.length),
    [goingPlayers.length],
  );

  const [teamAIds, setTeamAIds] = useState<string[]>([]);
  const [teamBIds, setTeamBIds] = useState<string[]>([]);

  const [slotsA, setSlotsA] = useState<(string | null)[]>([]);
  const [slotsB, setSlotsB] = useState<(string | null)[]>([]);
  const [formationId, setFormationId] = useState<string | null>(null);
  const [stepMode, setStepMode] = useState(false);
  const [lineupPhase, setLineupPhase] = useState<'beyaz' | 'siyah'>('beyaz');

  const formationInitKey = useRef<string>('');
  const lastPersistKey = useRef<string>('');

  const resolvedFormationId = useMemo(() => {
    if (formationId) return formationId;
    if (
      match?.lineupFormationId &&
      formationsForCount.some((f) => f.id === match.lineupFormationId)
    ) {
      return match.lineupFormationId;
    }
    return formationsForCount[0]?.id ?? null;
  }, [formationId, formationsForCount, match?.lineupFormationId]);

  const selectedFormation = useMemo(
    () => (resolvedFormationId ? getLineupFormationById(resolvedFormationId) : undefined),
    [resolvedFormationId],
  );

  useEffect(() => {
    const t = setTimeout(measure, 300);
    return () => clearTimeout(t);
  }, [match?.teamAIds, match?.teamBIds, measure]);

  useEffect(() => {
    if (!match) return;
    if (match.lineupLocked) {
      navigation.goBack();
      return;
    }
    if (formationMode) return;
    setTeamAIds(match.teamAIds.length ? match.teamAIds : []);
    setTeamBIds(match.teamBIds.length ? match.teamBIds : []);
  }, [match, navigation, formationMode]);

  useEffect(() => {
    if (!match) return;
    if (match.organizerId !== userId) {
      navigation.goBack();
    }
  }, [match, navigation, userId]);

  useEffect(() => {
    if (!match || match.lineupLocked || formationMode) return;
    const synced = syncTeamsWithGoing(teamAIds, teamBIds, goingPlayers);
    if (arraysShallowEqual(synced.A, teamAIds) && arraysShallowEqual(synced.B, teamBIds)) {
      return;
    }
    setTeamAIds(synced.A);
    setTeamBIds(synced.B);
    void setMatchTeams(match.id, synced.A, synced.B).catch((err) =>
      Alert.alert('Hata', err instanceof Error ? err.message : 'Kadro kaydedilemedi.'),
    );
  }, [match, goingPlayers, teamAIds, teamBIds, setMatchTeams, formationMode]);

  useEffect(() => {
    if (!match || !formationMode || formationsForCount.length === 0) return;
    const key = `${match.id}:${goingPlayers.length}`;
    if (formationInitKey.current === key) return;
    formationInitKey.current = key;
    const fid =
      match.lineupFormationId && formationsForCount.some((f) => f.id === match.lineupFormationId)
        ? match.lineupFormationId!
        : formationsForCount[0]!.id;
    const f = getLineupFormationById(fid);
    if (!f) return;
    setFormationId(fid);
    setSlotsA(buildSlotsFromCompact(match.teamAIds, f.playersPerTeam));
    setSlotsB(buildSlotsFromCompact(match.teamBIds, f.playersPerTeam));
  }, [match, formationMode, formationsForCount, goingPlayers.length]);

  useEffect(() => {
    if (!match || !formationMode || !selectedFormation) return;
    if (slotsA.length !== selectedFormation.playersPerTeam) return;
    const goingIds = new Set(goingPlayers.map((p) => p.id));
    setSlotsA((prev) => prev.map((id) => (id && goingIds.has(id) ? id : null)));
    setSlotsB((prev) => prev.map((id) => (id && goingIds.has(id) ? id : null)));
  }, [goingPlayers, formationMode, match, selectedFormation, slotsA.length]);

  const lineupDimensionsReady =
    !!selectedFormation &&
    slotsA.length === selectedFormation.playersPerTeam &&
    slotsB.length === selectedFormation.playersPerTeam;

  useEffect(() => {
    if (!match || match.lineupLocked || !formationMode || !lineupDimensionsReady) return;
    const a = compactSlots(slotsA);
    const b = compactSlots(slotsB);
    const fk = `${resolvedFormationId}|${JSON.stringify(a)}|${JSON.stringify(b)}`;
    if (lastPersistKey.current === fk) return;
    lastPersistKey.current = fk;
    void setMatchTeams(match.id, a, b, resolvedFormationId ?? undefined).catch((err) =>
      Alert.alert('Hata', err instanceof Error ? err.message : 'Kadro kaydedilemedi.'),
    );
  }, [
    match,
    formationMode,
    lineupDimensionsReady,
    slotsA,
    slotsB,
    resolvedFormationId,
    setMatchTeams,
  ]);

  const handleDropClassic = (playerId: string, absX: number, absY: number) => {
    const insideZone = (r: DropRect | undefined) =>
      r &&
      absX >= r.x &&
      absX <= r.x + r.w &&
      absY >= r.y &&
      absY <= r.y + r.h;

    let nextA = teamAIds.filter((id) => id !== playerId);
    let nextB = teamBIds.filter((id) => id !== playerId);

    if (insideZone(rects.current.A)) nextA = [...nextA, playerId];
    else if (insideZone(rects.current.B)) nextB = [...nextB, playerId];
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

  const handleDropFormation = useCallback(
    (playerId: string, absX: number, absY: number) => {
      const zone = pickZone(formationZonesRef.current, absX, absY);
      if (!zone) return;

      if (stepMode) {
        if (lineupPhase === 'beyaz' && zone.startsWith('A:')) return;
        if (lineupPhase === 'siyah' && zone.startsWith('B:')) return;
      }

      let curA = slotsA.map((s) => (s === playerId ? null : s));
      let curB = slotsB.map((s) => (s === playerId ? null : s));

      if (zone === 'bench') {
        setSlotsA(curA);
        setSlotsB(curB);
        return;
      }

      const m = /^([AB]):(\d+)$/.exec(zone);
      if (!m) return;
      const side = m[1] as 'A' | 'B';
      const idx = Number(m[2]);
      if (side === 'A') curA[idx] = playerId;
      else curB[idx] = playerId;

      setSlotsA(curA);
      setSlotsB(curB);
    },
    [lineupPhase, slotsA, slotsB, stepMode],
  );

  const benchPlayerIds = useMemo(() => {
    if (!formationMode || !selectedFormation) return [];
    const inSlots = new Set([...compactSlots(slotsA), ...compactSlots(slotsB)]);
    return goingPlayers.filter((p) => !inSlots.has(p.id)).map((p) => p.id);
  }, [formationMode, goingPlayers, selectedFormation, slotsA, slotsB]);

  const hasLineupContentForTitle = useMemo(() => {
    if (!match) return false;
    if (formationMode && lineupDimensionsReady && selectedFormation) {
      return compactSlots(slotsA).length + compactSlots(slotsB).length > 0;
    }
    if (formationMode) {
      return hasAssignedLineup(match);
    }
    return teamAIds.length > 0 || teamBIds.length > 0;
  }, [
    match,
    formationMode,
    lineupDimensionsReady,
    selectedFormation,
    slotsA,
    slotsB,
    teamAIds,
    teamBIds,
  ]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: hasLineupContentForTitle ? 'Kadroyu düzenle' : 'Kadro Kur',
    });
  }, [navigation, hasLineupContentForTitle]);

  const onBalance = () => {
    if (!match) return;
    if (formationMode && selectedFormation) {
      const { slotsA: na, slotsB: nb } = autoFillFormationSlots(goingPlayers, selectedFormation);
      setSlotsA(na);
      setSlotsB(nb);
      void setMatchTeams(
        match.id,
        compactSlots(na),
        compactSlots(nb),
        resolvedFormationId ?? undefined,
      ).catch((err) => Alert.alert('Hata', err instanceof Error ? err.message : 'Kadro kaydedilemedi.'));
      return;
    }
    const { A, B } = autoBalance(goingPlayers);
    setTeamAIds(A);
    setTeamBIds(B);
    void setMatchTeams(match.id, A, B).catch((err) =>
      Alert.alert('Hata', err instanceof Error ? err.message : 'Kadro kaydedilemedi.'),
    );
    setTimeout(measure, 50);
  };

  const onPickFormation = (id: string) => {
    const f = getLineupFormationById(id);
    if (!f) return;
    setFormationId(id);
    setSlotsA(Array.from({ length: f.playersPerTeam }, () => null));
    setSlotsB(Array.from({ length: f.playersPerTeam }, () => null));
    setLineupPhase('beyaz');
    if (match) {
      void setMatchTeams(match.id, [], [], id).catch((err) =>
        Alert.alert('Hata', err instanceof Error ? err.message : 'Kadro kaydedilemedi.'),
      );
    }
  };

  const onLayoutZone = (_e: LayoutChangeEvent) => {
    measure();
  };

  const saveAndExit = useCallback(async () => {
    if (!match) return;
    if (formationMode && selectedFormation) {
      if (!lineupDimensionsReady) {
        Alert.alert('Bekleyin', 'Kadro düzeni hazırlanıyor.');
        return;
      }
      const incomplete =
        slotsA.some((s) => s == null) ||
        slotsB.some((s) => s == null) ||
        benchPlayerIds.length > 0;
      if (incomplete) {
        Alert.alert(
          'Eksik yerleştirme',
          'Şablona göre tüm slotları doldurun; bekleyen oyuncu kalmamalı.',
        );
        return;
      }
      try {
        await setMatchTeams(
          match.id,
          compactSlots(slotsA),
          compactSlots(slotsB),
          resolvedFormationId ?? undefined,
        );
      } catch (err) {
        Alert.alert('Hata', err instanceof Error ? err.message : 'Kadro kaydedilemedi.');
        return;
      }
    } else {
      try {
        await setMatchTeams(match.id, teamAIds, teamBIds);
      } catch (err) {
        Alert.alert('Hata', err instanceof Error ? err.message : 'Kadro kaydedilemedi.');
        return;
      }
    }
    navigation.goBack();
  }, [
    match,
    formationMode,
    selectedFormation,
    lineupDimensionsReady,
    slotsA,
    slotsB,
    benchPlayerIds.length,
    setMatchTeams,
    resolvedFormationId,
    teamAIds,
    teamBIds,
    navigation,
  ]);

  const publishLineup = useCallback(async () => {
    if (!match) return;
    if (formationMode && selectedFormation) {
      if (!lineupDimensionsReady) {
        return;
      }
      const incomplete =
        slotsA.some((s) => s == null) ||
        slotsB.some((s) => s == null) ||
        benchPlayerIds.length > 0;
      if (incomplete) {
        Alert.alert(
          'Eksik yerleştirme',
          'Şablona göre tüm slotları doldurun; bekleyen oyuncu kalmamalı.',
        );
        return;
      }
      try {
        await setMatchTeams(
          match.id,
          compactSlots(slotsA),
          compactSlots(slotsB),
          resolvedFormationId ?? undefined,
        );
      } catch (err) {
        Alert.alert('Hata', err instanceof Error ? err.message : 'Kadro kaydedilemedi.');
        return;
      }
    } else {
      try {
        await setMatchTeams(match.id, teamAIds, teamBIds);
      } catch (err) {
        Alert.alert('Hata', err instanceof Error ? err.message : 'Kadro kaydedilemedi.');
        return;
      }
    }
    setConfirmOpen(false);
    try {
      await lockLineup(match.id);
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Kilitlenemedi.');
      return;
    }
    navigation.goBack();
  }, [
    match,
    formationMode,
    selectedFormation,
    lineupDimensionsReady,
    slotsA,
    slotsB,
    benchPlayerIds.length,
    setMatchTeams,
    lockLineup,
    resolvedFormationId,
    teamAIds,
    teamBIds,
    navigation,
  ]);

  if (!match) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Maç yok</Text>
      </View>
    );
  }

  const renderClassicCol = (
    ids: string[],
    zoneRef: React.RefObject<View | null>,
    title: string,
    side: 'a' | 'b',
    onDrop: (playerId: string, ax: number, ay: number) => void,
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
              onDragEnd={onDrop}
              testID={`lineup:player-card:${id}`}
            />
          );
        })}
      </ScrollView>
    </View>
  );

  const renderPitch = (
    formation: LineupFormation,
    slots: (string | null)[],
    side: 'A' | 'B',
    dimmed: boolean,
  ) => (
    <PitchHalfField
      formation={formation}
      slots={slots}
      side={side}
      dimmed={dimmed}
      zonesRef={formationZonesRef}
      getPlayer={getPlayer}
      testID={`lineup:pitch:${side.toLowerCase()}`}
      renderSlotContent={(slot: LineupSlotDef, p: Player | undefined, slotTestId: string) =>
        p ? (
          <View style={styles.slotInner}>
            <DraggableCard
              player={p}
              onDragEnd={handleDropFormation}
              testID={slotTestId}
            />
          </View>
        ) : (
          <View style={styles.slotInner}>
            <View style={styles.slotEmpty} testID={slotTestId}>
              <Text style={styles.slotRole}>{slot.roleLabel}</Text>
            </View>
          </View>
        )
      }
    />
  );

  if (formationMode && formationsForCount.length > 0 && selectedFormation) {
    return (
      <View style={styles.screen}>
        <Text style={styles.formationTitle}>
          {goingPlayers.length} kişi · {selectedFormation.playersPerTeam}’şer · {selectedFormation.label}
        </Text>
        <Text style={styles.hint} accessibilityRole="text">
          Havuzu kaydırın. Oyuncuyu basılı tutup slota veya havuza bırakın. Soldan sağa: Beyaz, Siyah.
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          testID="lineup:formation:scroll"
        >
          {formationsForCount.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => onPickFormation(f.id)}
              style={[styles.chip, resolvedFormationId === f.id && styles.chipSelected]}
              testID={`lineup:formation:${f.id}`}
            >
              <Text style={[styles.chipText, resolvedFormationId === f.id && styles.chipTextSelected]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.stepRow}>
          <Text style={styles.stepLabel}>Adım adım (önce Beyaz)</Text>
          <Switch
            testID="lineup:step-mode:switch"
            accessibilityLabel="Adım adım kadro modu"
            value={stepMode}
            onValueChange={(v) => {
              setStepMode(v);
              if (v) setLineupPhase('beyaz');
            }}
            trackColor={{ false: colors.border, true: colors.accentMuted }}
            thumbColor={stepMode ? colors.accent : colors.textMuted}
          />
        </View>
        {stepMode ? (
          <View style={styles.phaseBanner}>
            <Text style={styles.phaseText}>
              {lineupPhase === 'beyaz' ? 'Beyaz takım slotları aktif' : 'Siyah takım slotları aktif'}
            </Text>
            {lineupPhase === 'beyaz' ? (
              <PillButton
                title="Siyah takıma geç"
                variant="ghost"
                onPress={() => setLineupPhase('siyah')}
                testID="lineup:phase:goto-siyah"
              />
            ) : (
              <PillButton
                title="Beyaza dön"
                variant="ghost"
                onPress={() => setLineupPhase('beyaz')}
                testID="lineup:phase:goto-beyaz"
              />
            )}
          </View>
        ) : null}

        <ScrollView style={styles.scrollMain} contentContainerStyle={styles.scrollMainContent}>
          <View style={[styles.pitchColumns, stackHalfPitches && styles.pitchColumnsStack]}>
            <View style={styles.pitchCol}>
              <Text style={styles.pitchTeamTitle}>{TEAM_SIDE_LABELS.B}</Text>
              {renderPitch(
                selectedFormation,
                slotsB,
                'B',
                stepMode && lineupPhase === 'siyah',
              )}
            </View>
            <View style={styles.pitchCol}>
              <Text style={styles.pitchTeamTitle}>{TEAM_SIDE_LABELS.A}</Text>
              {renderPitch(
                selectedFormation,
                slotsA,
                'A',
                stepMode && lineupPhase === 'beyaz',
              )}
            </View>
          </View>

          <Text style={styles.benchTitle}>Havuz</Text>
          <FormationDropZone zoneKey="bench" zonesRef={formationZonesRef} style={styles.benchDrop}>
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.benchScroll}
              keyboardShouldPersistTaps="handled"
              testID="lineup:bench:scroll"
            >
              {benchPlayerIds.map((id) => {
                const p = getPlayer(id);
                if (!p) return null;
                return (
                  <DraggableCard
                    key={id}
                    player={p}
                    onDragEnd={handleDropFormation}
                    testID={`lineup:player-card:${id}`}
                  />
                );
              })}
              {benchPlayerIds.length === 0 ? (
                <Text style={styles.benchEmpty}>Tüm oyuncular sahada</Text>
              ) : null}
            </ScrollView>
          </FormationDropZone>
        </ScrollView>

        <View style={styles.actions}>
          <PillButton
            title="Otomatik Denge"
            variant="ghost"
            onPress={onBalance}
            testID="lineup:balance:press"
          />
          <PillButton
            title="Kaydet ve çık"
            onPress={() => void saveAndExit()}
            testID="lineup:save:press"
          />
          <PillButton
            title="Kadroyu yayınla"
            variant="ghost"
            onPress={() => setConfirmOpen(true)}
            testID="lineup:publish:open"
          />
        </View>

        <ConfirmationModal
          visible={confirmOpen}
          title="Kadroyu kilitle?"
          message="Tüm oyunculara kadro bildirilecek. Bu işlem geri alınamaz."
          confirmLabel="Onayla"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void publishLineup()}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.hint} accessibilityRole="text">
        Katılımcı sayısı şablon için 14, 16 veya 22 değil. Listeleri kaydırın; takımlar arası için basılı
        tutup sürükleyin.
      </Text>

      <View style={styles.row}>
        {renderClassicCol(teamBIds, zoneB, TEAM_SIDE_LABELS.B, 'b', handleDropClassic)}
        {renderClassicCol(teamAIds, zoneA, TEAM_SIDE_LABELS.A, 'a', handleDropClassic)}
      </View>

      <View style={styles.actions}>
        <PillButton
          title="Otomatik Denge"
          variant="ghost"
          onPress={onBalance}
          testID="lineup:balance:press"
        />
        <PillButton
          title="Kaydet ve çık"
          onPress={() => void saveAndExit()}
          testID="lineup:save:press"
        />
        <PillButton
          title="Kadroyu yayınla"
          variant="ghost"
          onPress={() => setConfirmOpen(true)}
          testID="lineup:publish:open"
        />
      </View>

      <ConfirmationModal
        visible={confirmOpen}
        title="Kadroyu kilitle?"
        message="Tüm oyunculara kadro bildirilecek. Bu işlem geri alınamaz."
        confirmLabel="Onayla"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void publishLineup()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    gap: spacing.sm,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  formationTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  chipRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  chipText: {
    ...typography.body,
    color: colors.text,
  },
  chipTextSelected: {
    color: colors.accent,
    fontWeight: '600',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  phaseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  phaseText: {
    ...typography.caption,
    color: colors.accent,
    flex: 1,
  },
  scrollMain: {
    flex: 1,
  },
  scrollMainContent: {
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  pitchColumns: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pitchColumnsStack: {
    flexDirection: 'column',
  },
  pitchCol: {
    flex: 1,
    gap: spacing.xs,
  },
  pitchTeamTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  slotInner: {
    minHeight: 44,
    justifyContent: 'center',
    width: '100%',
    alignItems: 'center',
  },
  slotEmpty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 56,
    backgroundColor: colors.background,
  },
  slotRole: {
    ...typography.micro,
    color: colors.textMuted,
  },
  benchTitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  benchDrop: {
    minHeight: 56,
  },
  benchScroll: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  benchEmpty: {
    ...typography.caption,
    color: colors.textMuted,
    paddingVertical: spacing.md,
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
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
