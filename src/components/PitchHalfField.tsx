import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { LineupFormation, LineupSlotDef } from '../data/lineupFormations';
import { resolveSlotAnchor } from '../data/lineupFormations';
import { colors, radius, spacing } from '../theme';
import type { Player } from '../types/domain';
import { FormationDropZone, type ZoneMap } from './FormationDropZone';

/** Chip merkezini anchor’a hizalamak için yarı boyutlar (px). */
const SLOT_CENTER_OFFSET_X = 40;
const SLOT_CENTER_OFFSET_Y = 28;

type Props = {
  formation: LineupFormation;
  slots: (string | null)[];
  side: 'A' | 'B';
  dimmed?: boolean;
  /** Boş slotlarda sürükleme hedefi vurgusu */
  highlightEmptySlots?: boolean;
  reduceMotion?: boolean;
  zonesRef: React.MutableRefObject<ZoneMap>;
  getPlayer: (id: string) => Player | undefined;
  renderSlotContent: (
    slot: LineupSlotDef,
    player: Player | undefined,
    testID: string,
  ) => React.ReactNode;
  testID?: string;
};

function SlotDropHighlight({
  empty,
  active,
  reduceMotion,
  children,
}: {
  empty: boolean;
  active: boolean;
  reduceMotion: boolean;
  children: React.ReactNode;
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!active || !empty || reduceMotion) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [active, empty, reduceMotion, pulse]);

  const ringStyle = useAnimatedStyle(() => {
    if (!active || !empty) {
      return {
        borderColor: colors.pitch.slotRing,
        shadowOpacity: 0,
      };
    }
    if (reduceMotion) {
      return {
        borderColor: colors.pitch.slotRingGlow,
        shadowOpacity: 0.35,
      };
    }
    const t = pulse.value;
    return {
      borderColor: t > 0.5 ? colors.pitch.slotRingGlow : colors.pitch.slotRing,
      shadowOpacity: 0.2 + t * 0.35,
    };
  });

  return (
    <Animated.View
      style={[
        styles.slotRing,
        empty ? ringStyle : styles.slotRingFilled,
        empty && active && reduceMotion && styles.slotRingReduceMotion,
      ]}
    >
      {children}
    </Animated.View>
  );
}

function PitchMarkings() {
  const line = colors.pitch.line;
  const strong = colors.pitch.lineStrong;
  return (
    <>
      <View style={[styles.markTop, { backgroundColor: strong }]} />
      <View style={[styles.markBottom, { backgroundColor: strong }]} />
      <View style={[styles.markCenterV, { backgroundColor: line }]} />
      <View style={[styles.penaltyVLeft, { backgroundColor: line }]} />
      <View style={[styles.penaltyVRight, { backgroundColor: line }]} />
      <View style={[styles.penaltyTop, { backgroundColor: line }]} />
      <View style={[styles.halfCircle, { borderColor: line }]} />
    </>
  );
}

/**
 * Taktik yarı saha: çim gradient, saha çizgileri, slot halkaları.
 * Koordinatlar normalize anchor ile View boyutuna göre yüzde konumlanır.
 */
export function PitchHalfField({
  formation,
  slots,
  side,
  dimmed,
  highlightEmptySlots = false,
  reduceMotion = false,
  zonesRef,
  getPlayer,
  renderSlotContent,
  testID,
}: Props) {
  return (
    <View
      style={[styles.pitchOuter, dimmed && styles.pitchDimmed]}
      pointerEvents={dimmed ? 'none' : 'auto'}
      testID={testID}
    >
      <LinearGradient
        colors={[colors.pitch.grassDeep, colors.pitch.grassMid, colors.pitch.grassLight]}
        start={{ x: 0.2, y: 1 }}
        end={{ x: 0.85, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.grassNoise} pointerEvents="none" />
      <PitchMarkings />
      <View style={styles.slotLayer}>
        {formation.slots.map((slot) => {
          const { xNorm, yNorm } = resolveSlotAnchor(slot, formation);
          const pid = slots[slot.index];
          const p = pid ? getPlayer(pid) : undefined;
          const zoneKey = `${side}:${slot.index}`;
          const slotTestId = `lineup:slot:${side.toLowerCase()}:${slot.index}`;
          const empty = pid == null;
          return (
            <FormationDropZone
              key={slot.index}
              zoneKey={zoneKey}
              zonesRef={zonesRef}
              style={[
                styles.slotAbs,
                {
                  left: `${xNorm * 100}%`,
                  bottom: `${yNorm * 100}%`,
                  marginLeft: -SLOT_CENTER_OFFSET_X,
                  marginBottom: -SLOT_CENTER_OFFSET_Y,
                },
              ]}
            >
              <SlotDropHighlight
                empty={empty}
                active={highlightEmptySlots}
                reduceMotion={reduceMotion}
              >
                {renderSlotContent(slot, p, slotTestId)}
              </SlotDropHighlight>
            </FormationDropZone>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pitchOuter: {
    position: 'relative',
    width: '100%',
    aspectRatio: 3 / 4,
    minHeight: 200,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
  },
  pitchDimmed: {
    opacity: 0.42,
  },
  grassNoise: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  markTop: {
    position: 'absolute',
    top: 0,
    left: spacing.sm,
    right: spacing.sm,
    height: 2,
    opacity: 0.95,
  },
  markBottom: {
    position: 'absolute',
    bottom: 0,
    left: spacing.sm,
    right: spacing.sm,
    height: 2,
    opacity: 0.95,
  },
  markCenterV: {
    position: 'absolute',
    top: '12%',
    bottom: '12%',
    left: '50%',
    width: 1,
    marginLeft: -0.5,
    opacity: 0.65,
  },
  penaltyVLeft: {
    position: 'absolute',
    bottom: 0,
    left: '14%',
    width: 1,
    height: '32%',
    opacity: 0.85,
  },
  penaltyVRight: {
    position: 'absolute',
    bottom: 0,
    right: '14%',
    width: 1,
    height: '32%',
    opacity: 0.85,
  },
  penaltyTop: {
    position: 'absolute',
    bottom: '32%',
    left: '14%',
    right: '14%',
    height: 1,
    opacity: 0.85,
  },
  halfCircle: {
    position: 'absolute',
    bottom: '28%',
    left: '50%',
    width: 56,
    height: 28,
    marginLeft: -28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    opacity: 0.55,
  },
  slotLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  slotAbs: {
    position: 'absolute',
    minWidth: 72,
    maxWidth: 108,
    alignItems: 'center',
  },
  slotRing: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.pitch.slotRing,
    backgroundColor: colors.pitch.slotFill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    minWidth: 56,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
  },
  slotRingFilled: {
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(0,0,0,0.12)',
    shadowOpacity: 0,
  },
  slotRingReduceMotion: {
    borderWidth: 2,
  },
});
