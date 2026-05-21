import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  LayoutAnimation,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
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
import { PitchHalfField } from '../components/PitchHalfField';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { PillButton } from '../components/PillButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { PositionBadge } from '../components/PositionBadge';
import { useFontScale } from '../hooks/useFontScale';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { radius, spacing, typography } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import type { GuestAttendee, Player } from '../types/domain';
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
import { useAuthStore, useGroupsStore, useMatchesStore, usePlayersStore } from '../store';
import type { GroupsStackParamList, HomeStackParamList } from '../navigation/types';
import { useUserFeedback } from '../utils/userFeedback';

type Route =
  | RouteProp<HomeStackParamList, 'LineupBuilder'>
  | RouteProp<GroupsStackParamList, 'LineupBuilder'>;
type Nav = NativeStackNavigationProp<
  HomeStackParamList & GroupsStackParamList
>;

const LONG_PRESS_MS = 150;
const DRAG_SCALE = 1.03;

const FORMATION_TOTALS = new Set([14, 16, 22]);

// Turkish abbreviated position labels for the compact player column
const POSITION_LABEL: Record<string, string> = {
  GK: 'KL',
  DEF: 'DEF',
  MID: 'OOS',
  FWD: 'SF',
};

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

/** Draggable player token — renders as a circular avatar on pitch slots, or a horizontal card in the pool list. */
function DraggableCard({
  player,
  onDragEnd,
  testID,
  isGuest,
  onDragActivated,
  onDragFinalize,
  onHoverMove,
  variant = 'card',
  slotGhostX,
  slotGhostY,
  slotGhostOpacity,
  disabled = false,
}: {
  player: Player;
  onDragEnd: (id: string, x: number, y: number) => void;
  testID: string;
  isGuest?: boolean;
  onDragActivated?: (playerId: string) => void;
  onDragFinalize?: () => void;
  onHoverMove?: (absX: number, absY: number) => void;
  variant?: 'card' | 'slot';
  slotGhostX?: SharedValue<number>;
  slotGhostY?: SharedValue<number>;
  slotGhostOpacity?: SharedValue<number>;
  disabled?: boolean;
}) {
  const styles = useLineupStyles();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const dragging = useSharedValue(0);
  const lastHoverX = useSharedValue(0);
  const lastHoverY = useSharedValue(0);
  const { isLarge } = useFontScale();

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart((e) => {
      if (variant === 'slot' && slotGhostX && slotGhostY && slotGhostOpacity) {
        slotGhostX.value = e.absoluteX;
        slotGhostY.value = e.absoluteY;
        slotGhostOpacity.value = withTiming(1, { duration: 30 });
      }
      if (onDragActivated) {
        runOnJS(onDragActivated)(player.id);
      }
    })
    .onUpdate((e) => {
      dragging.value = 1;
      tx.value = e.translationX;
      ty.value = e.translationY;
      if (variant === 'slot' && slotGhostX && slotGhostY) {
        slotGhostX.value = e.absoluteX;
        slotGhostY.value = e.absoluteY;
      }
      if (onHoverMove) {
        const dx = e.absoluteX - lastHoverX.value;
        const dy = e.absoluteY - lastHoverY.value;
        if (dx * dx + dy * dy > 16) {
          lastHoverX.value = e.absoluteX;
          lastHoverY.value = e.absoluteY;
          runOnJS(onHoverMove)(e.absoluteX, e.absoluteY);
        }
      }
    })
    .onEnd((e) => {
      if (variant === 'slot' && slotGhostOpacity) {
        slotGhostOpacity.value = withTiming(0, { duration: 50 });
      }
      runOnJS(onDragEnd)(player.id, e.absoluteX, e.absoluteY);
      tx.value = withSpring(0, Springs.snappy);
      ty.value = withSpring(0, Springs.snappy);
      dragging.value = withSpring(0, Springs.snappy);
    })
    .onFinalize(() => {
      if (variant === 'slot' && slotGhostOpacity) {
        slotGhostOpacity.value = withTiming(0, { duration: 50 });
      }
      if (onDragFinalize) {
        runOnJS(onDragFinalize)();
      }
      tx.value = withSpring(0, Springs.snappy);
      ty.value = withSpring(0, Springs.snappy);
      dragging.value = withSpring(0, Springs.snappy);
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
    opacity: variant === 'slot'
      ? interpolate(dragging.value, [0, 1], [1, 0], Extrapolation.CLAMP)
      : 1,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        style={variant === 'slot' ? [styles.slotToken, style] : [styles.card, style]}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={player.name}
        accessibilityHint="Sürükleyerek sahaya veya havuza taşıyın."
      >
        {variant === 'slot' ? (
          <PlayerAvatar name={player.name} uri={player.photoUri} size={44} />
        ) : (
          <>
            <PlayerAvatar name={player.name} uri={player.photoUri} size={36} />
            <View style={styles.cardMeta}>
              <Text style={styles.cardName} numberOfLines={isLarge ? 2 : 1}>
                {player.name}
              </Text>
              <View style={styles.cardBadgesRow}>
                <PositionBadge position={player.position} />
                {isGuest ? (
                  <View style={styles.guestChip}>
                    <Text style={styles.guestChipText}>M</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const GHOST_HALF_W = 35;
const GHOST_HALF_H = 50;
const SLOT_GHOST_HALF = 28;

/**
 * Floating ghost card rendered at screenFormation root level during pool drag.
 * Bypasses ScrollView clipping and elevation stacking that would hide the dragged card.
 */
function PoolDragGhost({
  player,
  ghostX,
  ghostY,
  ghostOpacity,
  containerOriginX,
  containerOriginY,
}: {
  player: Player;
  ghostX: SharedValue<number>;
  ghostY: SharedValue<number>;
  ghostOpacity: SharedValue<number>;
  containerOriginX: SharedValue<number>;
  containerOriginY: SharedValue<number>;
}) {
  const styles = useLineupStyles();
  const { colors } = useTheme();
  const shadowColor = colors.shadow;

  const ghostStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: ghostX.value - containerOriginX.value - GHOST_HALF_W,
    top: ghostY.value - containerOriginY.value - GHOST_HALF_H,
    zIndex: 999,
    elevation: 20,
    opacity: ghostOpacity.value,
    shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  }));

  const posColor = colors.position[player.position] ?? colors.textMuted;
  const posLabel = POSITION_LABEL[player.position] ?? player.position;
  const shortName =
    player.name.length > 9 ? (player.name.split(' ')[0] ?? player.name) : player.name;

  return (
    <Animated.View style={[styles.columnItem, ghostStyle]} pointerEvents="none">
      <View style={[styles.columnAvatarWrap, { borderColor: colors.accent }]}>
        <PlayerAvatar name={player.name} uri={player.photoUri} size={40} />
      </View>
      <Text style={styles.columnName} numberOfLines={2}>
        {shortName}
      </Text>
      <View style={styles.columnPosRow}>
        <View style={[styles.columnPosDot, { backgroundColor: posColor }]} />
        <Text style={[styles.columnPosLabel, { color: posColor }]}>{posLabel}</Text>
      </View>
    </Animated.View>
  );
}

function SlotDragGhost({
  player,
  ghostX,
  ghostY,
  ghostOpacity,
  containerOriginX,
  containerOriginY,
}: {
  player: Player;
  ghostX: SharedValue<number>;
  ghostY: SharedValue<number>;
  ghostOpacity: SharedValue<number>;
  containerOriginX: SharedValue<number>;
  containerOriginY: SharedValue<number>;
}) {
  const styles = useLineupStyles();
  const { colors } = useTheme();
  const shadowColor = colors.shadow;

  const ghostStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: ghostX.value - containerOriginX.value - SLOT_GHOST_HALF,
    top: ghostY.value - containerOriginY.value - SLOT_GHOST_HALF,
    zIndex: 999,
    elevation: 20,
    opacity: ghostOpacity.value,
    shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
  }));

  return (
    <Animated.View style={[styles.slotGhostRing, ghostStyle]} pointerEvents="none">
      <PlayerAvatar name={player.name} uri={player.photoUri} size={44} />
    </Animated.View>
  );
}

/**
 * Vertical avatar card shown in the right player column.
 * Only rendered for bench (unplaced) players — ring is always accent green.
 * Ghost SharedValues are updated on the UI thread (no runOnJS) for 60fps drag tracking.
 */
function PlayerColumnItem({
  player,
  onDragEnd,
  onDragActivated,
  onDragFinalize,
  onHoverMove,
  poolGhostX,
  poolGhostY,
  poolGhostOpacity,
  testID,
  disabled = false,
}: {
  player: Player;
  onDragEnd: (id: string, x: number, y: number) => void;
  testID: string;
  onDragActivated?: (playerId: string) => void;
  onDragFinalize?: () => void;
  onHoverMove?: (absX: number, absY: number) => void;
  poolGhostX: SharedValue<number>;
  poolGhostY: SharedValue<number>;
  poolGhostOpacity: SharedValue<number>;
  disabled?: boolean;
}) {
  const styles = useLineupStyles();
  const { colors } = useTheme();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const dragging = useSharedValue(0);
  const lastHoverX = useSharedValue(0);
  const lastHoverY = useSharedValue(0);

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart((e) => {
      dragging.value = 1;
      poolGhostX.value = e.absoluteX;
      poolGhostY.value = e.absoluteY;
      poolGhostOpacity.value = withTiming(1, { duration: 30 });
      if (onDragActivated) runOnJS(onDragActivated)(player.id);
    })
    .onUpdate((e) => {
      dragging.value = 1;
      tx.value = e.translationX;
      ty.value = e.translationY;
      poolGhostX.value = e.absoluteX;
      poolGhostY.value = e.absoluteY;
      if (onHoverMove) {
        const dx = e.absoluteX - lastHoverX.value;
        const dy = e.absoluteY - lastHoverY.value;
        if (dx * dx + dy * dy > 16) {
          lastHoverX.value = e.absoluteX;
          lastHoverY.value = e.absoluteY;
          runOnJS(onHoverMove)(e.absoluteX, e.absoluteY);
        }
      }
    })
    .onEnd((e) => {
      runOnJS(onDragEnd)(player.id, e.absoluteX, e.absoluteY);
      tx.value = withSpring(0, Springs.snappy);
      ty.value = withSpring(0, Springs.snappy);
      dragging.value = withSpring(0, Springs.snappy);
    })
    .onFinalize(() => {
      poolGhostOpacity.value = withTiming(0, { duration: 50 });
      if (onDragFinalize) runOnJS(onDragFinalize)();
      tx.value = withSpring(0, Springs.snappy);
      ty.value = withSpring(0, Springs.snappy);
      dragging.value = withSpring(0, Springs.snappy);
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: interpolate(dragging.value, [0, 1], [1, DRAG_SCALE], Extrapolation.CLAMP) },
    ],
    zIndex: dragging.value ? 10 : 1,
    elevation: dragging.value ? 8 : 2,
    shadowOpacity: dragging.value ? 0.4 : 0,
    shadowRadius: dragging.value ? 12 : 0,
    shadowOffset: { width: 0, height: dragging.value ? 4 : 0 },
    opacity: interpolate(dragging.value, [0, 1], [1, 0], Extrapolation.CLAMP),
  }));

  const posColor = colors.position[player.position] ?? colors.textMuted;
  const posLabel = POSITION_LABEL[player.position] ?? player.position;

  // Fit long names inside the narrow column
  const shortName =
    player.name.length > 9 ? (player.name.split(' ')[0] ?? player.name) : player.name;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[styles.columnItem, animStyle]}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={player.name}
        accessibilityHint="Basılı tutup sahaya sürükleyin."
      >
        <View style={[styles.columnAvatarWrap, { borderColor: colors.accent }]}>
          <PlayerAvatar name={player.name} uri={player.photoUri} size={40} />
        </View>
        <Text style={styles.columnName} numberOfLines={2}>
          {shortName}
        </Text>
        <View style={styles.columnPosRow}>
          <View style={[styles.columnPosDot, { backgroundColor: posColor }]} />
          <Text style={[styles.columnPosLabel, { color: posColor }]}>{posLabel}</Text>
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
  const groupMemberships = useGroupsStore((s) => s.groupMemberships);
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
  const [hoveredZoneKey, setHoveredZoneKey] = useState<string | null>(null);
  const [isDraggingFromPool, setIsDraggingFromPool] = useState(false);
  const [isDraggingFromSlot, setIsDraggingFromSlot] = useState(false);

  const reduceMotion = useReduceMotion();
  const { showApiErrorToast, showValidationToast, showToast } = useUserFeedback();

  // Ghost overlay SharedValues (worklet'ten güncellenir — JS roundtrip yok)
  const poolGhostX = useSharedValue(0);
  const poolGhostY = useSharedValue(0);
  const poolGhostOpacity = useSharedValue(0);
  const slotGhostX = useSharedValue(0);
  const slotGhostY = useSharedValue(0);
  const slotGhostOpacity = useSharedValue(0);
  const containerOriginX = useSharedValue(0);
  const containerOriginY = useSharedValue(0);
  const screenFormationRef = useRef<View>(null);

  const zoneA = useRef<View>(null);
  const zoneB = useRef<View>(null);
  const rects = useRef<{ A?: DropRect; B?: DropRect }>({});

  const formationZonesRef = useRef<ZoneMap>(new Map());

  const insets = useSafeAreaInsets();

  const measure = useCallback(() => {
    const cb =
      (key: keyof typeof rects.current) =>
      (x: number, y: number, w: number, h: number) => {
        rects.current[key] = { x, y, w, h };
      };
    zoneA.current?.measureInWindow(cb('A'));
    zoneB.current?.measureInWindow(cb('B'));
  }, []);

  const guestIds = useMemo(
    () => new Set((match?.guestAttendees ?? []).map((g) => g.id)),
    [match?.guestAttendees],
  );

  const goingPlayers = useMemo((): Player[] => {
    if (!match) return [];
    const goingIds = new Set(
      match.attendees.filter((a) => a.status === 'going').map((a) => a.playerId),
    );
    const registered = playersAll.filter((p) => goingIds.has(p.id));
    const guestPlayers: Player[] = (match.guestAttendees ?? []).map(
      (g: GuestAttendee): Player => ({
        id: g.id,
        name: g.displayName,
        photoUri: undefined,
        position: g.position,
        preferredFoot: 'right',
        stats: { matchesPlayed: 0, goals: 0, assists: 0, wins: 0, losses: 0, draws: 0 },
      }),
    );
    return [...registered, ...guestPlayers];
  }, [match, playersAll]);

  const getDisplayPlayer = useCallback(
    (id: string): Player | undefined => {
      const p = getPlayer(id);
      if (p) return p;
      const g = match?.guestAttendees?.find((ga) => ga.id === id);
      if (!g) return undefined;
      return {
        id: g.id,
        name: g.displayName,
        photoUri: undefined,
        position: g.position,
        preferredFoot: 'right',
        stats: { matchesPlayed: 0, goals: 0, assists: 0, wins: 0, losses: 0, draws: 0 },
      };
    },
    [getPlayer, match?.guestAttendees],
  );

  const formationRosterTotal = match?.maxPlayers ?? 0;

  const formationMode = useMemo(
    () => FORMATION_TOTALS.has(formationRosterTotal),
    [formationRosterTotal],
  );

  const formationsForCount = useMemo(
    () => getLineupFormationsForTotalPlayers(formationRosterTotal),
    [formationRosterTotal],
  );

  const strictFormationFill = useMemo(
    () => !!match && formationMode && goingPlayers.length === match.maxPlayers,
    [formationMode, goingPlayers.length, match],
  );

  const [teamAIds, setTeamAIds] = useState<string[]>([]);
  const [teamBIds, setTeamBIds] = useState<string[]>([]);

  const [slotsA, setSlotsA] = useState<(string | null)[]>([]);
  const [slotsB, setSlotsB] = useState<(string | null)[]>([]);
  const [formationId, setFormationId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

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
    const t = setTimeout(measure, 100);
    return () => clearTimeout(t);
  }, [match?.teamAIds, match?.teamBIds, measure]);

  const canManageMatch = useMemo(() => {
    if (!match) return false;
    const isOrganizer = match.organizerId === userId;
    const myGroupMembership = groupMemberships.find(
      (m) => m.groupId === match.groupId && m.playerId === userId,
    );
    const isGroupManager =
      myGroupMembership?.role === 'owner' || myGroupMembership?.role === 'admin';
    return isOrganizer || (match.groupId != null && isGroupManager);
  }, [match, userId, groupMemberships]);

  /**
   * View-only: organizatör olmayanlar her zaman (görüntüleme), organizatörler
   * sadece kadro kilitli olduğunda (önce "Kilidi kaldır" gerekir).
   */
  const isViewOnly = !canManageMatch || (match?.lineupLocked ?? false);

  useEffect(() => {
    if (!match) return;
    if (formationMode) return;
    setTeamAIds(match.teamAIds.length ? match.teamAIds : []);
    setTeamBIds(match.teamBIds.length ? match.teamBIds : []);
  }, [match, formationMode]);

  useEffect(() => {
    if (!match || isViewOnly || formationMode) return;
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
  }, [match, isViewOnly, goingPlayers, teamAIds, teamBIds, setMatchTeams, formationMode, showApiErrorToast]);

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
    // Slot pozisyon bilgisi yerel store'da korunuyorsa kullan; yoksa compact diziden inşa et.
    const initA =
      match.lineupSlotsA && match.lineupSlotsA.length === f.playersPerTeam
        ? match.lineupSlotsA
        : buildSlotsFromCompact(match.teamAIds, f.playersPerTeam);
    const initB =
      match.lineupSlotsB && match.lineupSlotsB.length === f.playersPerTeam
        ? match.lineupSlotsB
        : buildSlotsFromCompact(match.teamBIds, f.playersPerTeam);
    setSlotsA(initA);
    setSlotsB(initB);
  }, [match, formationMode, formationsForCount, formationRosterTotal]);

  useEffect(() => {
    if (!match || isViewOnly || !formationMode || !selectedFormation) return;
    if (slotsA.length !== selectedFormation.playersPerTeam) return;
    const goingIds = new Set(goingPlayers.map((p) => p.id));
    setSlotsA((prev) => prev.map((id) => (id && goingIds.has(id) ? id : null)));
    setSlotsB((prev) => prev.map((id) => (id && goingIds.has(id) ? id : null)));
  }, [goingPlayers, isViewOnly, formationMode, match, selectedFormation, slotsA.length]);

  const lineupDimensionsReady =
    !!selectedFormation &&
    slotsA.length === selectedFormation.playersPerTeam &&
    slotsB.length === selectedFormation.playersPerTeam;

  useEffect(() => {
    if (!match || isViewOnly || !formationMode || !lineupDimensionsReady) return;
    const a = compactSlots(slotsA);
    const b = compactSlots(slotsB);
    // Fingerprint sparse dizileri kapsar; compact aynı kalsa bile slot değişimi algılanır.
    const fk = `${resolvedFormationId}|${JSON.stringify(slotsA)}|${JSON.stringify(slotsB)}`;
    if (lastPersistKey.current === fk) return;
    lastPersistKey.current = fk;
    void setMatchTeams(match.id, a, b, resolvedFormationId ?? undefined, slotsA, slotsB).catch((err) =>
      showApiErrorToast(err, {
        uiOperation: 'LineupBuilder:persistFormation',
        fallbackMessage: 'Kadro kaydedilemedi.',
        mapOperation: 'replaceMatchTeamPlayersRemote',
      }),
    );
  }, [
    match,
    isViewOnly,
    formationMode,
    lineupDimensionsReady,
    slotsA,
    slotsB,
    resolvedFormationId,
    setMatchTeams,
    showApiErrorToast,
  ]);

  const handleDropClassic = (playerId: string, absX: number, absY: number) => {
    if (isViewOnly) return;
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
    requestAnimationFrame(measure);
  };

  const handleDropFormation = useCallback(
    (playerId: string, absX: number, absY: number) => {
      if (isViewOnly) return;
      const zone = pickFormationZoneOrdered(formationZonesRef.current, absX, absY);
      if (!zone) return;
      const result = applyLineupFormationDrop(slotsA, slotsB, playerId, zone);
      if (!result || !result.changed) return;
      setSlotsA(result.slotsA);
      setSlotsB(result.slotsB);
      void lightImpact();
    },
    [isViewOnly, slotsA, slotsB],
  );

  const onDragActivated = useCallback((playerId: string) => {
    void selectionTick();
    setDraggingPlayerId(playerId);
  }, []);

  const onDragActivatedFromPool = useCallback((playerId: string) => {
    void selectionTick();
    setDraggingPlayerId(playerId);
    setIsDraggingFromPool(true);
  }, []);

  const onDragActivatedFromSlot = useCallback((playerId: string) => {
    void selectionTick();
    setDraggingPlayerId(playerId);
    setIsDraggingFromSlot(true);
  }, []);

  const onHoverMove = useCallback((absX: number, absY: number) => {
    const key = pickFormationZoneOrdered(formationZonesRef.current, absX, absY);
    setHoveredZoneKey((prev) => (prev === key ? prev : key));
  }, []);

  const onFormationDragFinalize = useCallback(() => {
    setDraggingPlayerId(null);
    setHoveredZoneKey(null);
    setIsDraggingFromPool(false);
    setIsDraggingFromSlot(false);
  }, []);

  const onResetLineup = useCallback(() => {
    if (isViewOnly || !selectedFormation || !match) return;
    const empty = Array.from<string | null>({ length: selectedFormation.playersPerTeam }).fill(null);
    setSlotsA(empty);
    setSlotsB(empty);
    void setMatchTeams(match.id, [], [], resolvedFormationId ?? undefined, empty, empty).catch((err) =>
      showApiErrorToast(err, {
        uiOperation: 'LineupBuilder:reset',
        fallbackMessage: 'Kadro sıfırlanamadı.',
        mapOperation: 'replaceMatchTeamPlayersRemote',
      }),
    );
  }, [isViewOnly, selectedFormation, match, resolvedFormationId, setMatchTeams, showApiErrorToast]);

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
    const title = isViewOnly
      ? 'Kadro'
      : hasLineupContentForTitle
        ? 'Kadroyu düzenle'
        : 'Kadro Kur';
    navigation.setOptions({
      title,
      headerRight: formationMode && !isViewOnly
        ? () => (
            <Pressable
              onPress={onResetLineup}
              style={styles.resetBtn}
              testID="lineup:reset:press"
              accessibilityRole="button"
              accessibilityLabel="Kadroyu sıfırla"
            >
              <Text style={styles.resetBtnText}>Sıfırla</Text>
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, hasLineupContentForTitle, formationMode, isViewOnly, onResetLineup, styles.resetBtn, styles.resetBtnText]);

  const onBalance = () => {
    if (isViewOnly || !match) return;
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
        na,
        nb,
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
    requestAnimationFrame(measure);
  };

  const applyFormationChange = (id: string, f: ReturnType<typeof getLineupFormationById>) => {
    if (!f) return;
    if (!reduceMotion) {
      LayoutAnimation.configureNext({
        duration: 180,
        create: { type: 'easeInEaseOut', property: 'opacity' },
        update: { type: 'spring', springDamping: 0.7 },
        delete: { type: 'easeInEaseOut', property: 'opacity' },
      });
    }
    setFormationId(id);
    // Slot index↔pozisyon eşleşmesi formasyona özgü — aynı boyut farklı yapı demek.
    // Formasyon her değişiminde slotları sıfırla; oyuncular havuza döner.
    const empty: (string | null)[] = Array.from({ length: f.playersPerTeam }, () => null);
    setSlotsA(empty);
    setSlotsB(empty);
    if (match) {
      void setMatchTeams(match.id, [], [], id, empty, empty).catch((err) =>
        showApiErrorToast(err, {
          uiOperation: 'LineupBuilder:pickFormation',
          fallbackMessage: 'Kadro kaydedilemedi.',
          mapOperation: 'replaceMatchTeamPlayersRemote',
        }),
      );
    }
  };

  const onPickFormation = (id: string) => {
    if (isViewOnly) return;
    // Aynı formasyon tekrar seçildiyse hiçbir şey yapma
    if (id === resolvedFormationId) return;
    const f = getLineupFormationById(id);
    if (!f) return;
    // Slotlarda atanmış oyuncu varsa, değişiklik bunları sileceğinden onay al
    const hasSlotsAssigned = slotsA.some(Boolean) || slotsB.some(Boolean);
    if (hasSlotsAssigned) {
      Alert.alert(
        'Formasyon değiştirilsin mi?',
        'Tüm slot yerleştirmeleri sıfırlanacak. Oyuncular havuza geri dönecek.',
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Değiştir', style: 'destructive', onPress: () => applyFormationChange(id, f) },
        ],
      );
    } else {
      applyFormationChange(id, f);
    }
  };

  const onLayoutZone = (_e: LayoutChangeEvent) => {
    measure();
  };

  const saveAndExit = useCallback(async () => {
    if (isViewOnly || !match) return;
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
          slotsA,
          slotsB,
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
    isViewOnly,
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
    if (isViewOnly || !match) return;
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
          slotsA,
          slotsB,
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
    isViewOnly,
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
          const p = getDisplayPlayer(id);
          if (!p) return null;
          return (
            <DraggableCard
              key={id}
              player={p}
              isGuest={guestIds.has(id)}
              onDragEnd={onDrop}
              testID={`lineup:player-card:${id}`}
              disabled={isViewOnly}
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
    highlightEmptySlots: boolean,
    horizontal: boolean,
    currentHoveredZoneKey: string | null,
  ) => (
    <PitchHalfField
      formation={formation}
      slots={slots}
      side={side}
      dimmed={false}
      highlightEmptySlots={highlightEmptySlots}
      hoveredZoneKey={currentHoveredZoneKey}
      stretch={horizontal}
      reduceMotion={reduceMotion}
      zonesRef={formationZonesRef}
      getPlayer={getDisplayPlayer}
      testID={`lineup:pitch:${side.toLowerCase()}`}
      horizontal={horizontal}
      teamTint={side === 'B' ? 'light' : 'dark'}
      renderSlotContent={(slot: LineupSlotDef, p: Player | undefined, slotTestId: string) => {
        const roleTextColor =
          side === 'B' ? colors.pitch.textOnLightTint : colors.pitch.textOnDarkTint;
        return p ? (
          <View style={styles.slotInner}>
            <DraggableCard
              player={p}
              variant="slot"
              onDragEnd={handleDropFormation}
              onDragActivated={onDragActivatedFromSlot}
              onDragFinalize={onFormationDragFinalize}
              onHoverMove={onHoverMove}
              slotGhostX={slotGhostX}
              slotGhostY={slotGhostY}
              slotGhostOpacity={slotGhostOpacity}
              testID={slotTestId}
              disabled={isViewOnly}
            />
          </View>
        ) : (
          <View style={styles.slotInner}>
            <View style={styles.slotEmpty} testID={slotTestId}>
              <Text style={[styles.slotRole, { color: roleTextColor }]}>{slot.roleLabel}</Text>
            </View>
          </View>
        );
      }}
    />
  );

  if (formationMode && formationsForCount.length > 0 && selectedFormation) {
    const poolDragPlayer = isDraggingFromPool && draggingPlayerId ? getDisplayPlayer(draggingPlayerId) : null;
    return (
      // screenFormation is a row: leftSide (header+pitches+actions) + full-height player column
      <View
        ref={screenFormationRef}
        style={styles.screenFormation}
        onLayout={() => {
          screenFormationRef.current?.measureInWindow((x, y) => {
            containerOriginX.value = x;
            containerOriginY.value = y;
          });
        }}
      >

        {/* ── Left side: header + pitches + action bar ── */}
        <View style={styles.leftSide}>

          {/* Compact header strip */}
          <View style={styles.formationHeader}>
            {isViewOnly ? (
              <View
                style={styles.formationDropdownBtn}
                accessibilityRole="text"
                accessibilityLabel={`Dizilim: ${selectedFormation.label}`}
              >
                <Ionicons name="apps-outline" size={15} color={colors.accent} />
                <Text style={styles.formationDropdownLabel}>Dizilim</Text>
                <View style={styles.formationDropdownDivider} />
                <Text style={styles.formationDropdownBtnText}>{selectedFormation.label}</Text>
              </View>
            ) : (
              <Pressable
                onPress={() => setDropdownOpen(true)}
                style={styles.formationDropdownBtn}
                testID="lineup:formation:dropdown"
                accessibilityRole="button"
                accessibilityLabel={`Dizilim: ${selectedFormation.label}. Değiştirmek için dokun.`}
              >
                <Ionicons name="apps-outline" size={15} color={colors.accent} />
                <Text style={styles.formationDropdownLabel}>Dizilim</Text>
                <View style={styles.formationDropdownDivider} />
                <Text style={styles.formationDropdownBtnText}>{selectedFormation.label}</Text>
                <Ionicons name="chevron-down" size={13} color={colors.accent} />
              </Pressable>
            )}
          </View>

          {/* View-only banner — açıklama göster, kullanıcı neden düzenleyemediğini anlasın */}
          {isViewOnly ? (
            <View style={styles.viewOnlyBanner}>
              <Text style={styles.viewOnlyBannerText}>
                {canManageMatch
                  ? 'Kadro kilitli — değişiklik için önce kilidi kaldırın.'
                  : 'Kadroyu yalnızca organizatör düzenleyebilir.'}
              </Text>
            </View>
          ) : null}

          {/* Pitches area — stacked vertically, horizontal (landscape) mode, no scroll */}
          <View style={styles.pitchesArea}>
            <View style={styles.pitchesContent}>
              <View style={styles.pitchColumns}>
                <View style={styles.pitchCol}>
                  <View style={styles.pitchWrapper}>
                    {renderPitch(selectedFormation, slotsB, 'B', draggingPlayerId != null, true, hoveredZoneKey)}
                    <Text style={[styles.pitchTeamTitleOverlay, styles.pitchTeamTitleLight]}>{TEAM_SIDE_LABELS.B}</Text>
                  </View>
                </View>
                <View style={styles.pitchCol}>
                  <View style={styles.pitchWrapper}>
                    {renderPitch(selectedFormation, slotsA, 'A', draggingPlayerId != null, true, hoveredZoneKey)}
                    <Text style={[styles.pitchTeamTitleOverlay, styles.pitchTeamTitleDark]}>{TEAM_SIDE_LABELS.A}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Action bar: ghost actions row + full-width primary CTA (sadece düzenleme modunda) */}
          {!isViewOnly ? (
            <View style={[styles.actionsBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
              <View style={styles.actionsSecondaryRow}>
                <PillButton
                  title="Dengele"
                  variant="ghost"
                  onPress={onBalance}
                  testID="lineup:balance:press"
                  accessibilityLabel="Akıllı Denge. Takımları oyuncu reyting ortalamalarına göre dengeler."
                  style={styles.actionBtnSecondary}
                />
                <PillButton
                  title="Yayınla"
                  variant="ghost"
                  onPress={() => setConfirmOpen(true)}
                  testID="lineup:publish:open"
                  accessibilityLabel="Kadroyu yayınla ve kilitle."
                  style={styles.actionBtnSecondary}
                />
              </View>
              <PillButton
                title="Kaydet ve çık"
                onPress={() => void saveAndExit()}
                testID="lineup:save:press"
                style={styles.actionBtnPrimary}
              />
            </View>
          ) : null}

        </View>

        {/* ── Right player column — full screen height, bench drop zone ── */}
        <FormationDropZone
          zoneKey="bench"
          zonesRef={formationZonesRef}
          style={styles.playerColumn}
        >
          <Text style={styles.columnHeader}>
            {benchPlayerIds.length > 0 ? `Havuz · ${benchPlayerIds.length}` : 'Havuz'}
          </Text>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.columnContent}
            nestedScrollEnabled
            testID="lineup:bench:scroll"
          >
            {benchPlayerIds.map((id) => {
              const p = getDisplayPlayer(id);
              if (!p) return null;
              return (
                <PlayerColumnItem
                  key={id}
                  player={p}
                  onDragEnd={handleDropFormation}
                  onDragActivated={onDragActivatedFromPool}
                  onDragFinalize={onFormationDragFinalize}
                  onHoverMove={onHoverMove}
                  poolGhostX={poolGhostX}
                  poolGhostY={poolGhostY}
                  poolGhostOpacity={poolGhostOpacity}
                  testID={`lineup:player-card:${id}`}
                  disabled={isViewOnly}
                />
              );
            })}
            {benchPlayerIds.length === 0 ? (
              <Text style={styles.columnEmpty}>Tümü sahada</Text>
            ) : null}
          </ScrollView>
        </FormationDropZone>

        {/* Ghost overlay for pool → pitch drag — renders above all content, bypasses ScrollView clip */}
        {poolDragPlayer ? (
          <PoolDragGhost
            player={poolDragPlayer}
            ghostX={poolGhostX}
            ghostY={poolGhostY}
            ghostOpacity={poolGhostOpacity}
            containerOriginX={containerOriginX}
            containerOriginY={containerOriginY}
          />
        ) : null}

        {/* Ghost overlay for slot → slot drag — bypasses pitchesArea overflow:hidden stacking context */}
        {isDraggingFromSlot && draggingPlayerId ? (
          <SlotDragGhost
            player={getDisplayPlayer(draggingPlayerId)!}
            ghostX={slotGhostX}
            ghostY={slotGhostY}
            ghostOpacity={slotGhostOpacity}
            containerOriginX={containerOriginX}
            containerOriginY={containerOriginY}
          />
        ) : null}

        {/* Formation picker dropdown modal */}
        <Modal
          transparent
          animationType="fade"
          visible={dropdownOpen}
          onRequestClose={() => setDropdownOpen(false)}
        >
          <Pressable style={styles.dropdownBackdrop} onPress={() => setDropdownOpen(false)}>
            <Pressable style={styles.dropdownSheet} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.dropdownSheetTitle}>Dizilim seç</Text>
              {formationsForCount.map((f) => (
                <Pressable
                  key={f.id}
                  style={styles.dropdownOption}
                  onPress={() => {
                    onPickFormation(f.id);
                    setDropdownOpen(false);
                  }}
                  testID={`lineup:formation:${f.id}`}
                >
                  <Text style={[
                    styles.dropdownOptionText,
                    resolvedFormationId === f.id && styles.dropdownOptionTextSelected,
                  ]}>
                    {f.label}
                  </Text>
                  {resolvedFormationId === f.id ? (
                    <Ionicons name="checkmark" size={18} color={colors.accent} />
                  ) : null}
                </Pressable>
              ))}
            </Pressable>
          </Pressable>
        </Modal>

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

  // ── Classic mode (non-14/16/22 player counts) ──
  return (
    <View style={styles.screen}>
      <Text style={styles.hint} accessibilityRole="text">
        {isViewOnly
          ? 'Yayınlanan kadro görüntüleniyor.'
          : 'Maç kadro boyutu (max) 14, 16 veya 22 değil; taktik şablon kapalı. Listeleri kaydırın; takımlar arası için basılı tutup sürükleyin.'}
      </Text>

      <View style={styles.row}>
        {renderClassicCol(teamBIds, zoneB, TEAM_SIDE_LABELS.B, 'b', handleDropClassic)}
        {renderClassicCol(teamAIds, zoneA, TEAM_SIDE_LABELS.A, 'a', handleDropClassic)}
      </View>

      {!isViewOnly ? (
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
      ) : null}

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
    // ── Screen shells ──
    screen: {
      flex: 1,
      backgroundColor: t.colors.background,
      padding: spacing.md,
      gap: spacing.sm,
    },
    // formation mode: row so player column spans full height
    screenFormation: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: t.colors.background,
    },

    // ── Left side (header + pitches + actions) ──
    leftSide: {
      flex: 1,
      flexDirection: 'column',
    },

    // ── Formation header strip ──
    formationHeader: {
      flexShrink: 0,
      paddingTop: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingBottom: 0,
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
    viewOnlyBanner: {
      marginHorizontal: spacing.md,
      marginTop: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      backgroundColor: t.colors.surface,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    viewOnlyBannerText: {
      ...typography.caption,
      color: t.colors.textMuted,
    },
    hintWarn: {
      ...typography.caption,
      color: t.colors.accent,
      lineHeight: 18,
    },

    // ── Formation dropdown ──
    formationDropdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    formationDropdownLabel: {
      ...typography.caption,
      color: t.colors.textMuted,
      letterSpacing: 0.3,
    },
    formationDropdownBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      minHeight: 38,
      elevation: 1,
      shadowColor: t.colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
    },
    formationDropdownDivider: {
      width: 1,
      height: 14,
      backgroundColor: t.colors.border,
      marginHorizontal: 2,
    },
    formationDropdownBtnText: {
      ...typography.body,
      color: t.colors.accent,
      fontWeight: '700',
      flex: 1,
      textAlign: 'right',
      marginRight: 2,
    },
    dropdownBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    dropdownSheet: {
      backgroundColor: t.colors.surface,
      borderRadius: radius.card,
      padding: spacing.md,
      width: '100%',
      maxWidth: 320,
      gap: spacing.xs,
      elevation: 8,
      shadowColor: t.colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    dropdownSheetTitle: {
      ...typography.subtitle,
      color: t.colors.text,
      paddingBottom: spacing.xs,
    },
    dropdownOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      borderRadius: radius.sm,
      minHeight: 44,
    },
    dropdownOptionText: {
      ...typography.body,
      color: t.colors.text,
    },
    dropdownOptionTextSelected: {
      color: t.colors.accent,
      fontWeight: '600',
    },

    // ── Pitches area ──
    pitchesArea: {
      flex: 0.8,
      overflow: 'hidden',
    },
    pitchTeamTitle: {
      ...typography.caption,
      color: t.colors.textMuted,
      textAlign: 'center',
      paddingBottom: 2,
    },
    pitchWrapper: {
      flex: 1,
      position: 'relative',
    },
    pitchTeamTitleOverlay: {
      position: 'absolute',
      top: spacing.xs,
      left: spacing.xs,
      zIndex: 2,
      ...typography.caption,
      fontWeight: '600',
    },
    pitchTeamTitleLight: {
      color: t.colors.pitch.textOnLightTint,
    },
    pitchTeamTitleDark: {
      color: t.colors.pitch.textOnDarkTint,
    },
    pitchesContent: {
      flex: 1,
      paddingHorizontal: spacing.xs,
      paddingBottom: 0,
      paddingTop: spacing.xs,
    },
    // Pitches stacked vertically in landscape (horizontal) mode — no scroll
    pitchColumns: {
      flex: 1,
      flexDirection: 'column',
      gap: 0,
    },
    pitchCol: {
      flex: 1,
    },

    // ── 2-row action bar ──
    actionsBar: {
      flexDirection: 'column',
      gap: spacing.xs,
      paddingTop: spacing.xs,
      paddingHorizontal: spacing.md,
      flexShrink: 0,
    },
    actionsSecondaryRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    actionBtnSecondary: {
      flex: 1,
      minHeight: 40,
      paddingVertical: 6,
    },
    actionBtnPrimary: {
      minHeight: 44,
      paddingVertical: 8,
    },

    // ── Right player column (full screen height) ──
    playerColumn: {
      width: 86,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: t.colors.border,
      backgroundColor: t.colors.surface,
      paddingTop: spacing.sm,
    },
    columnHeader: {
      fontSize: 10,
      fontWeight: '700',
      color: t.colors.textMuted,
      textAlign: 'center',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      paddingBottom: spacing.xs,
    },
    columnContent: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingBottom: spacing.lg,
      paddingHorizontal: spacing.xs,
    },
    columnItem: {
      width: 70,
      alignItems: 'center',
      gap: 3,
      paddingVertical: 6,
      paddingHorizontal: 4,
      borderRadius: radius.sm,
      backgroundColor: t.colors.background,
      borderWidth: 1,
      borderColor: t.colors.border,
      elevation: 2,
      shadowColor: t.colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.12,
      shadowRadius: 3,
    },
    columnAvatarWrap: {
      borderRadius: 24,
      borderWidth: 2,
      padding: 2,
    },
    columnName: {
      fontSize: 10,
      fontWeight: '500',
      color: t.colors.text,
      textAlign: 'center',
      lineHeight: 13,
    },
    columnPosRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    columnPosDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
    },
    columnPosLabel: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    columnEmpty: {
      ...typography.micro,
      color: t.colors.textMuted,
      textAlign: 'center',
      paddingTop: spacing.md,
    },

    // ── Slot content ──
    slotInner: {
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    slotToken: {
      width: 44,
      height: 44,
      borderRadius: 22,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    slotGhostRing: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.45)',
      backgroundColor: 'rgba(0,0,0,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
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

    // ── Classic mode ──
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
      shadowColor: t.colors.shadow,
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
      shadowColor: t.colors.shadow,
    },
    cardName: {
      ...typography.body,
      color: t.colors.text,
    },
    cardMeta: {
      flex: 1,
    },
    cardBadgesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    guestChip: {
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 3,
      backgroundColor: t.colors.border,
    },
    guestChipText: {
      ...typography.micro,
      color: t.colors.textMuted,
      fontWeight: '700',
    },
    actions: {
      gap: spacing.sm,
      paddingBottom: spacing.lg,
    },

    // ── Reset header button ──
    resetBtn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      minHeight: 44,
      justifyContent: 'center',
    },
    resetBtnText: {
      ...typography.body,
      color: t.colors.danger,
    },

    // ── Shared ──
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.background,
    },
    emptyText: {
      color: t.colors.textMuted,
    },
  }),
);
