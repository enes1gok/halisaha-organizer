import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import {
  LayoutAnimation,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TEAM_SIDE_LABELS } from '../constants/teamLabels';
import { Springs } from '../utils/animations';
import {
  getLineupFormationById,
  getLineupFormationsForTotalPlayers,
  type LineupFormation,
  type LineupSlotDef,
} from '../data/lineupFormations';
import { FormationDropZone, type DropRect, type ZoneMap } from '../components/FormationDropZone';
import { LineupFormationThumbnail } from '../components/LineupFormationThumbnail';
import { PitchHalfField } from '../components/PitchHalfField';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { PillButton } from '../components/PillButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { PositionBadge } from '../components/PositionBadge';
import { useFontScale } from '../hooks/useFontScale';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { radius, spacing, typography } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import type { Player } from '../types/domain';
import { lightImpact, selectionTick } from '../utils/haptics';
import {
  applyLineupFormationDrop,
  pickFormationZoneOrdered,
} from '../utils/lineupFormationDrop';
import {
  balanceClassicTeamsByRating,
  balanceFormationSlotsByRating,
} from '../utils/balanceTeamsByRating';
import { buildSlotsFromCompact, compactSlots } from '../utils/lineupSlots';
import { hasAssignedLineup } from '../utils/matchRoster';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore, useMatchesStore, usePlayersStore } from '../store';
import type { GroupsStackParamList, HomeStackParamList, MyMatchesStackParamList } from '../navigation/types';
import { useUserFeedback } from '../utils/userFeedback';

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

/** BottomSheet snap points — sabit referans (her render’da yeni dizi vermemek için). */
const BENCH_SHEET_SNAP_POINTS: Array<string | number> = ['20%', '48%'];

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function arraysShallowEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
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
  const { A: addA, B: addB } = balanceClassicTeamsByRating(missing);
  return { A: [...nextA, ...addA], B: [...nextB, ...addB] };
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

function DraggableCard({
  player,
  onDragEnd,
  testID,
  onDragActivated,
  onDragFinalize,
}: {
  player: Player;
  onDragEnd: (id: string, x: number, y: number) => void;
  testID: string;
  onDragActivated?: (playerId: string) => void;
  onDragFinalize?: () => void;
}) {
  const styles = useLineupStyles();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const dragging = useSharedValue(0);
  const { isLarge } = useFontScale();

  const pan = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart(() => {
      if (onDragActivated) {
        runOnJS(onDragActivated)(player.id);
      }
    })
    .onUpdate((e) => {
      dragging.value = 1;
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e) => {
      runOnJS(onDragEnd)(player.id, e.absoluteX, e.absoluteY);
      tx.value = withSpring(0, Springs.interactive);
      ty.value = withSpring(0, Springs.interactive);
      dragging.value = withSpring(0, Springs.interactive);
    })
    .onFinalize(() => {
      if (onDragFinalize) {
        runOnJS(onDragFinalize)();
      }
      tx.value = withSpring(0, Springs.interactive);
      ty.value = withSpring(0, Springs.interactive);
      dragging.value = withSpring(0, Springs.interactive);
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
          <Text style={styles.cardName} numberOfLines={isLarge ? 2 : 1}>
            {player.name}
          </Text>
          <PositionBadge position={player.position} />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export function LineupBuilderScreen() {
  const styles = useLineupStyles();
  const { colors } = useTheme();
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
  const [draggingPlayerId, setDraggingPlayerId] = useState<string | null>(null);

  const reduceMotion = useReduceMotion();
  const { showApiErrorToast, showValidationToast, showToast } = useUserFeedback();

  const zoneA = useRef<View>(null);
  const zoneB = useRef<View>(null);
  const rects = useRef<{ A?: DropRect; B?: DropRect }>({});

  const formationZonesRef = useRef<ZoneMap>(new Map());
  const benchSheetRef = useRef<React.ElementRef<typeof BottomSheet>>(null);

  const insets = useSafeAreaInsets();
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

  const formationRosterTotal = match?.maxPlayers ?? 0;

  const formationMode = useMemo(
    () => FORMATION_TOTALS.has(formationRosterTotal),
    [formationRosterTotal],
  );

  const formationsForCount = useMemo(
    () => getLineupFormationsForTotalPlayers(formationRosterTotal),
    [formationRosterTotal],
  );

  /** Tam katılım: tüm slotların dolu olması zorunlu (aksi halde sadece “going” oyuncular sahada). */
  const strictFormationFill = useMemo(
    () =>
      !!match && formationMode && goingPlayers.length === match.maxPlayers,
    [formationMode, goingPlayers.length, match],
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
      showApiErrorToast(err, {
        uiOperation: 'LineupBuilder:syncGoing',
        fallbackMessage: 'Kadro kaydedilemedi.',
        mapOperation: 'replaceMatchTeamPlayersRemote',
      }),
    );
  }, [match, goingPlayers, teamAIds, teamBIds, setMatchTeams, formationMode, showApiErrorToast]);

  useEffect(() => {
    if (!match || !formationMode || formationsForCount.length === 0) return;
    const key = `${match.id}:${formationRosterTotal}`;
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
  }, [match, formationMode, formationsForCount, formationRosterTotal]);

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
      showApiErrorToast(err, {
        uiOperation: 'LineupBuilder:persistFormation',
        fallbackMessage: 'Kadro kaydedilemedi.',
        mapOperation: 'replaceMatchTeamPlayersRemote',
      }),
    );
  }, [
    match,
    formationMode,
    lineupDimensionsReady,
    slotsA,
    slotsB,
    resolvedFormationId,
    setMatchTeams,
    showApiErrorToast,
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
        showApiErrorToast(err, {
          uiOperation: 'LineupBuilder:dropClassic',
          fallbackMessage: 'Kadro kaydedilemedi.',
          mapOperation: 'replaceMatchTeamPlayersRemote',
        }),
      );
    }
    setTimeout(measure, 50);
  };

  const handleDropFormation = useCallback(
    (playerId: string, absX: number, absY: number) => {
      const zone = pickFormationZoneOrdered(formationZonesRef.current, absX, absY);
      if (!zone) return;

      if (stepMode) {
        if (lineupPhase === 'beyaz' && zone.startsWith('A:')) return;
        if (lineupPhase === 'siyah' && zone.startsWith('B:')) return;
      }

      const result = applyLineupFormationDrop(slotsA, slotsB, playerId, zone);
      if (!result || !result.changed) return;

      setSlotsA(result.slotsA);
      setSlotsB(result.slotsB);
      void lightImpact();
    },
    [lineupPhase, slotsA, slotsB, stepMode],
  );

  const sheetTimingConfig = useMemo(
    () => (reduceMotion ? ({ duration: 0 } as const) : undefined),
    [reduceMotion],
  );

  const onPitchDragActivated = useCallback((playerId: string) => {
    void selectionTick();
    setDraggingPlayerId(playerId);
  }, []);

  const onBenchDragActivated = useCallback(
    (playerId: string) => {
      void selectionTick();
      setDraggingPlayerId(playerId);
      benchSheetRef.current?.snapToIndex(0, sheetTimingConfig);
    },
    [sheetTimingConfig],
  );

  const onFormationDragFinalize = useCallback(() => {
    setDraggingPlayerId(null);
    benchSheetRef.current?.snapToIndex(1, sheetTimingConfig);
  }, [sheetTimingConfig]);

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
      const { slotsA: na, slotsB: nb } = balanceFormationSlotsByRating(
        goingPlayers,
        selectedFormation,
      );
      setSlotsA(na);
      setSlotsB(nb);
      void setMatchTeams(
        match.id,
        compactSlots(na),
        compactSlots(nb),
        resolvedFormationId ?? undefined,
      )
        .then(() => {
          showToast({
            title: 'Kadro dengelendi',
            message: 'Takımlar reyting ortalamalarına göre oluşturuldu.',
            variant: 'success',
          });
        })
        .catch((err) =>
          showApiErrorToast(err, {
            uiOperation: 'LineupBuilder:balanceFormation',
            fallbackMessage: 'Kadro kaydedilemedi.',
            mapOperation: 'replaceMatchTeamPlayersRemote',
          }),
        );
      return;
    }
    const { A, B } = balanceClassicTeamsByRating(goingPlayers);
    setTeamAIds(A);
    setTeamBIds(B);
    void setMatchTeams(match.id, A, B)
      .then(() => {
        showToast({
          title: 'Kadro dengelendi',
          message: 'Takımlar reyting ortalamalarına göre oluşturuldu.',
          variant: 'success',
        });
      })
      .catch((err) =>
        showApiErrorToast(err, {
          uiOperation: 'LineupBuilder:balanceClassic',
          fallbackMessage: 'Kadro kaydedilemedi.',
          mapOperation: 'replaceMatchTeamPlayersRemote',
        }),
      );
    setTimeout(measure, 50);
  };

  const onPickFormation = (id: string) => {
    const f = getLineupFormationById(id);
    if (!f) return;
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    const sameSize =
      selectedFormation != null && selectedFormation.playersPerTeam === f.playersPerTeam;
    setFormationId(id);
    if (sameSize) {
      setLineupPhase('beyaz');
      if (match) {
        void setMatchTeams(
          match.id,
          compactSlots(slotsA),
          compactSlots(slotsB),
          id,
        ).catch((err) =>
          showApiErrorToast(err, {
            uiOperation: 'LineupBuilder:pickFormationSameSize',
            fallbackMessage: 'Kadro kaydedilemedi.',
            mapOperation: 'replaceMatchTeamPlayersRemote',
          }),
        );
      }
      return;
    }
    setSlotsA(Array.from({ length: f.playersPerTeam }, () => null));
    setSlotsB(Array.from({ length: f.playersPerTeam }, () => null));
    setLineupPhase('beyaz');
    if (match) {
      void setMatchTeams(match.id, [], [], id).catch((err) =>
        showApiErrorToast(err, {
          uiOperation: 'LineupBuilder:pickFormationReset',
          fallbackMessage: 'Kadro kaydedilemedi.',
          mapOperation: 'replaceMatchTeamPlayersRemote',
        }),
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
        showToast({
          title: 'Bekleyin',
          message: 'Kadro düzeni hazırlanıyor.',
          variant: 'info',
        });
        return;
      }
      const incomplete =
        benchPlayerIds.length > 0 ||
        (strictFormationFill &&
          (slotsA.some((s) => s == null) || slotsB.some((s) => s == null)));
      if (incomplete) {
        showValidationToast(
          'Eksik yerleştirme',
          strictFormationFill
            ? 'Şablona göre tüm slotları doldurun; bekleyen oyuncu kalmamalı.'
            : 'Tüm katılımcıları sahaya yerleştirin; havuzda oyuncu kalmamalı. (Tam kadro değilken boş slot kalabilir.)',
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
        showApiErrorToast(err, {
          uiOperation: 'LineupBuilder:saveAndExitFormation',
          fallbackMessage: 'Kadro kaydedilemedi.',
          mapOperation: 'replaceMatchTeamPlayersRemote',
        });
        return;
      }
    } else {
      try {
        await setMatchTeams(match.id, teamAIds, teamBIds);
      } catch (err) {
        showApiErrorToast(err, {
          uiOperation: 'LineupBuilder:saveAndExitClassic',
          fallbackMessage: 'Kadro kaydedilemedi.',
          mapOperation: 'replaceMatchTeamPlayersRemote',
        });
        return;
      }
    }
    navigation.goBack();
  }, [
    match,
    formationMode,
    selectedFormation,
    lineupDimensionsReady,
    strictFormationFill,
    slotsA,
    slotsB,
    benchPlayerIds.length,
    setMatchTeams,
    resolvedFormationId,
    teamAIds,
    teamBIds,
    navigation,
    showToast,
    showValidationToast,
    showApiErrorToast,
  ]);

  const publishLineup = useCallback(async () => {
    if (!match) return;
    if (formationMode && selectedFormation) {
      if (!lineupDimensionsReady) {
        return;
      }
      const incomplete =
        benchPlayerIds.length > 0 ||
        (strictFormationFill &&
          (slotsA.some((s) => s == null) || slotsB.some((s) => s == null)));
      if (incomplete) {
        showValidationToast(
          'Eksik yerleştirme',
          strictFormationFill
            ? 'Şablona göre tüm slotları doldurun; bekleyen oyuncu kalmamalı.'
            : 'Tüm katılımcıları sahaya yerleştirin; havuzda oyuncu kalmamalı. (Tam kadro değilken boş slot kalabilir.)',
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
        showApiErrorToast(err, {
          uiOperation: 'LineupBuilder:publishFormation',
          fallbackMessage: 'Kadro kaydedilemedi.',
          mapOperation: 'replaceMatchTeamPlayersRemote',
        });
        return;
      }
    } else {
      try {
        await setMatchTeams(match.id, teamAIds, teamBIds);
      } catch (err) {
        showApiErrorToast(err, {
          uiOperation: 'LineupBuilder:publishClassic',
          fallbackMessage: 'Kadro kaydedilemedi.',
          mapOperation: 'replaceMatchTeamPlayersRemote',
        });
        return;
      }
    }
    setConfirmOpen(false);
    try {
      await lockLineup(match.id);
    } catch (err) {
      showApiErrorToast(err, {
        uiOperation: 'LineupBuilder:lockLineup',
        fallbackMessage: 'Kilitlenemedi.',
        mapOperation: 'updateMatchOrganizerFieldsRemote',
      });
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
    strictFormationFill,
    setMatchTeams,
    lockLineup,
    resolvedFormationId,
    teamAIds,
    teamBIds,
    navigation,
    showValidationToast,
    showApiErrorToast,
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
    highlightEmptySlots: boolean,
  ) => (
    <PitchHalfField
      formation={formation}
      slots={slots}
      side={side}
      dimmed={dimmed}
      highlightEmptySlots={highlightEmptySlots}
      reduceMotion={reduceMotion}
      zonesRef={formationZonesRef}
      getPlayer={getPlayer}
      testID={`lineup:pitch:${side.toLowerCase()}`}
      renderSlotContent={(slot: LineupSlotDef, p: Player | undefined, slotTestId: string) =>
        p ? (
          <View style={styles.slotInner}>
            <DraggableCard
              player={p}
              onDragEnd={handleDropFormation}
              onDragActivated={onPitchDragActivated}
              onDragFinalize={onFormationDragFinalize}
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
      <View style={styles.screenFormation}>
        <View style={styles.formationTop}>
          <Text style={styles.formationTitle}>
            {goingPlayers.length}/{match.maxPlayers} katılımcı · {selectedFormation.playersPerTeam}’şer ·{' '}
            {selectedFormation.label}
          </Text>
          {!strictFormationFill ? (
            <Text style={styles.hintWarn} accessibilityRole="text">
              Tam kadro değil; boş slot bırakabilirsiniz. Tüm katılımcılar sahada olmalı.
            </Text>
          ) : null}
          <Text style={styles.hint} accessibilityRole="text">
            Havuzu alttan çekerek genişletin; oyuncuları yatay kaydırabilirsiniz. Oyuncuyu basılı tutup
            slota veya havuza bırakın. Soldan sağa: Siyah, Beyaz.
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

          <LineupFormationThumbnail
            formation={selectedFormation}
            teamLabelB={TEAM_SIDE_LABELS.B}
            teamLabelA={TEAM_SIDE_LABELS.A}
            testID="lineup:formation:thumbnail"
          />

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
        </View>

        <ScrollView
          style={styles.pitchScroll}
          contentContainerStyle={styles.pitchScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.pitchColumns, stackHalfPitches && styles.pitchColumnsStack]}>
            <View style={styles.pitchCol}>
              <Text style={styles.pitchTeamTitle}>{TEAM_SIDE_LABELS.B}</Text>
              {renderPitch(
                selectedFormation,
                slotsB,
                'B',
                stepMode && lineupPhase === 'siyah',
                draggingPlayerId != null && (!stepMode || lineupPhase === 'beyaz'),
              )}
            </View>
            <View style={styles.pitchCol}>
              <Text style={styles.pitchTeamTitle}>{TEAM_SIDE_LABELS.A}</Text>
              {renderPitch(
                selectedFormation,
                slotsA,
                'A',
                stepMode && lineupPhase === 'beyaz',
                draggingPlayerId != null && (!stepMode || lineupPhase === 'siyah'),
              )}
            </View>
          </View>
        </ScrollView>

        <View style={styles.actionsBar}>
          <PillButton
            title="Akıllı Denge"
            variant="ghost"
            onPress={onBalance}
            testID="lineup:balance:press"
            accessibilityLabel="Akıllı Denge. Takımları oyuncu reyting ortalamalarına göre dengeler."
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

        <BottomSheet
          ref={benchSheetRef}
          index={1}
          snapPoints={BENCH_SHEET_SNAP_POINTS}
          enablePanDownToClose={false}
          enableContentPanningGesture={false}
          enableDynamicSizing={false}
          animateOnMount
          overrideReduceMotion={reduceMotion ? ReduceMotion.Always : ReduceMotion.System}
          backgroundStyle={styles.benchSheetBg}
          handleIndicatorStyle={styles.benchHandleIndicator}
        >
          <BottomSheetView
            style={[styles.benchSheetBody, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
          >
            <Text style={styles.benchSheetHeading} accessibilityRole="header">
              Havuz
              {benchPlayerIds.length > 0 ? ` · ${benchPlayerIds.length}` : ''}
            </Text>
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
                      onDragActivated={onBenchDragActivated}
                      onDragFinalize={onFormationDragFinalize}
                      testID={`lineup:player-card:${id}`}
                    />
                  );
                })}
                {benchPlayerIds.length === 0 ? (
                  <Text style={styles.benchEmpty}>Tüm oyuncular sahada</Text>
                ) : null}
              </ScrollView>
            </FormationDropZone>
          </BottomSheetView>
        </BottomSheet>

        <ConfirmationModal
          visible={confirmOpen}
          title="Kadroyu kilitle?"
          message="Tüm oyunculara kadro bildirilecek."
          destructiveHint="Bu işlem geri alınamaz."
          confirmLabel="Onayla"
          danger
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void publishLineup()}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.hint} accessibilityRole="text">
        Maç kadro boyutu (max) 14, 16 veya 22 değil; taktik şablon kapalı. Listeleri kaydırın; takımlar
        arası için basılı tutup sürükleyin.
      </Text>

      <View style={styles.row}>
        {renderClassicCol(teamBIds, zoneB, TEAM_SIDE_LABELS.B, 'b', handleDropClassic)}
        {renderClassicCol(teamAIds, zoneA, TEAM_SIDE_LABELS.A, 'a', handleDropClassic)}
      </View>

      <View style={styles.actions}>
        <PillButton
          title="Akıllı Denge"
          variant="ghost"
          onPress={onBalance}
          testID="lineup:balance:press"
          accessibilityLabel="Akıllı Denge. Takımları oyuncu reyting ortalamalarına göre dengeler."
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
        message="Tüm oyunculara kadro bildirilecek."
        destructiveHint="Bu işlem geri alınamaz."
        confirmLabel="Onayla"
        danger
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void publishLineup()}
      />
    </View>
  );
}

const useLineupStyles = makeStyles((t) =>
  StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: t.colors.background,
    padding: spacing.md,
    gap: spacing.sm,
  },
  screenFormation: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  formationTop: {
    gap: spacing.sm,
    flexShrink: 0,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  pitchScroll: {
    flex: 1,
    flexGrow: 1,
    minHeight: 120,
  },
  pitchScrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  actionsBar: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    flexShrink: 0,
  },
  benchSheetBg: {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  benchHandleIndicator: {
    backgroundColor: t.colors.textMuted,
    width: 40,
  },
  benchSheetBody: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  benchSheetHeading: {
    ...typography.caption,
    color: t.colors.textMuted,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.background,
  },
  formationTitle: {
    ...typography.subtitle,
    color: t.colors.text,
  },
  hint: {
    ...typography.caption,
    color: t.colors.textMuted,
    lineHeight: 18,
  },
  hintWarn: {
    ...typography.caption,
    color: t.colors.accent,
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
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: t.colors.accent,
    backgroundColor: t.colors.accentMuted,
  },
  chipText: {
    ...typography.body,
    color: t.colors.text,
  },
  chipTextSelected: {
    color: t.colors.accent,
    fontWeight: '600',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepLabel: {
    ...typography.caption,
    color: t.colors.textMuted,
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
    color: t.colors.accent,
    flex: 1,
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
    color: t.colors.textMuted,
    textAlign: 'center',
  },
  slotInner: {
    minHeight: 44,
    justifyContent: 'center',
    width: '100%',
    alignItems: 'center',
  },
  slotEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 44,
    paddingHorizontal: spacing.xs,
  },
  slotRole: {
    ...typography.micro,
    color: t.colors.textMuted,
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
    color: t.colors.textMuted,
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
    borderColor: t.colors.border,
    borderRadius: radius.card,
    padding: spacing.sm,
    backgroundColor: t.colors.surface,
    maxHeight: 420,
    elevation: 2,
    shadowColor: 'black',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  zoneTitle: {
    ...typography.caption,
    color: t.colors.textMuted,
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
    borderColor: t.colors.border,
    backgroundColor: t.colors.background,
    shadowColor: 'black',
  },
  cardName: {
    ...typography.body,
    color: t.colors.text,
  },
  cardMeta: {
    flex: 1,
  },
  emptyText: {
    color: t.colors.textMuted,
  },
  actions: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
}),
);
