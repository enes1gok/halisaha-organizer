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
import { radius, spacing } from '../theme';
import { makeStyles, useThemeColors } from '../theme/ThemeContext';
import type { Player } from '../types/domain';
import { FormationDropZone, type ZoneMap } from './FormationDropZone';

/** Chip merkezini anchor'a hizalamak için yarı boyutlar (px). */
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
  /** Sahanın yatay (landscape) modda gösterilmesi — GK solda, FW sağda. */
  horizontal?: boolean;
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
  const styles = usePitchStyles();
  const colors = useThemeColors();
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

function PitchMarkings({ horizontal }: { horizontal?: boolean }) {
  const styles = usePitchStyles();
  const { pitch } = useThemeColors();
  const line = pitch.line;
  const strong = pitch.lineStrong;

  if (horizontal) {
    return (
      <>
        {/* Kale çizgisi (sol kenar — GK tarafı) */}
        <View style={[styles.hMarkLeft, { backgroundColor: strong }]} />
        {/* Orta saha çizgisi (sağ kenar) */}
        <View style={[styles.hMarkRight, { backgroundColor: strong }]} />
        {/* Yatay orta çizgi */}
        <View style={[styles.hMarkCenterH, { backgroundColor: line }]} />
        {/* Ceza sahası alt çizgisi */}
        <View style={[styles.hPenaltyBottom, { backgroundColor: line }]} />
        {/* Ceza sahası üst çizgisi */}
        <View style={[styles.hPenaltyTop, { backgroundColor: line }]} />
        {/* Ceza sahası sağ duvarı */}
        <View style={[styles.hPenaltyRight, { backgroundColor: line }]} />
        {/* Penaltı yayı (sağa bakan yarım daire) */}
        <View style={[styles.hHalfCircle, { borderColor: line }]} />
      </>
    );
  }

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
 * `horizontal=true` ile 90° CW döndürülmüş landscape mod (GK solda, FW sağda).
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
  horizontal = false,
}: Props) {
  const styles = usePitchStyles();
  const { pitch } = useThemeColors();

  // aspectRatio ve minHeight yatay modda override edilir
  const containerOverride = horizontal
    ? ({ aspectRatio: 4 / 3, minHeight: 120 } as const)
    : ({ aspectRatio: 3 / 4, minHeight: 200 } as const);

  return (
    <View
      style={[styles.pitchOuter, containerOverride, dimmed && styles.pitchDimmed]}
      pointerEvents={dimmed ? 'none' : 'auto'}
      testID={testID}
    >
      <LinearGradient
        colors={[pitch.grassDeep, pitch.grassMid, pitch.grassLight]}
        start={{ x: 0.2, y: 1 }}
        end={{ x: 0.85, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.grassNoise} pointerEvents="none" />
      <PitchMarkings horizontal={horizontal} />
      <View style={styles.slotLayer}>
        {formation.slots.map((slot) => {
          const { xNorm, yNorm } = resolveSlotAnchor(slot, formation);
          const pid = slots[slot.index];
          const p = pid ? getPlayer(pid) : undefined;
          const zoneKey = `${side}:${slot.index}`;
          const slotTestId = `lineup:slot:${side.toLowerCase()}:${slot.index}`;
          const empty = pid == null;

          // 90° CW rotasyon: portrait-bottom → horizontal-left, portrait-left → horizontal-top
          const slotPositionStyle = horizontal
            ? ({
                left: `${yNorm * 100}%`,
                top: `${xNorm * 100}%`,
                marginLeft: -SLOT_CENTER_OFFSET_X,
                marginTop: -SLOT_CENTER_OFFSET_Y,
              } as const)
            : ({
                left: `${xNorm * 100}%`,
                bottom: `${yNorm * 100}%`,
                marginLeft: -SLOT_CENTER_OFFSET_X,
                marginBottom: -SLOT_CENTER_OFFSET_Y,
              } as const);

          return (
            <FormationDropZone
              key={slot.index}
              zoneKey={zoneKey}
              zonesRef={zonesRef}
              style={[styles.slotAbs, slotPositionStyle]}
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

const usePitchStyles = makeStyles((t) =>
  StyleSheet.create({
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

    // ── Portrait markings ──
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

    // ── Horizontal (landscape) markings — 90° CW mapped from portrait ──
    hMarkLeft: {
      // portrait markBottom → GK tarafı sol kenar
      position: 'absolute',
      left: 0,
      top: spacing.sm,
      bottom: spacing.sm,
      width: 2,
      opacity: 0.95,
    },
    hMarkRight: {
      // portrait markTop → uzak taraf sağ kenar
      position: 'absolute',
      right: 0,
      top: spacing.sm,
      bottom: spacing.sm,
      width: 2,
      opacity: 0.95,
    },
    hMarkCenterH: {
      // portrait markCenterV → yatay orta çizgi
      position: 'absolute',
      top: '50%',
      left: '12%',
      right: '12%',
      height: 1,
      marginTop: -0.5,
      opacity: 0.65,
    },
    hPenaltyBottom: {
      // portrait penaltyVLeft → ceza sahası alt sınırı
      position: 'absolute',
      bottom: '14%',
      left: 0,
      width: '32%',
      height: 1,
      opacity: 0.85,
    },
    hPenaltyTop: {
      // portrait penaltyVRight → ceza sahası üst sınırı
      position: 'absolute',
      top: '14%',
      left: 0,
      width: '32%',
      height: 1,
      opacity: 0.85,
    },
    hPenaltyRight: {
      // portrait penaltyTop → ceza sahası sağ duvarı
      position: 'absolute',
      top: '14%',
      bottom: '14%',
      left: '32%',
      width: 1,
      opacity: 0.85,
    },
    hHalfCircle: {
      // portrait halfCircle → sağa bakan penaltı yayı
      position: 'absolute',
      left: '28%',
      top: '50%',
      marginTop: -28,
      width: 28,
      height: 56,
      borderTopRightRadius: 28,
      borderBottomRightRadius: 28,
      borderWidth: 1,
      borderLeftWidth: 0,
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
      borderColor: t.colors.pitch.slotRing,
      backgroundColor: t.colors.pitch.slotFill,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.xs,
      minWidth: 56,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: t.colors.accent,
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
  }),
);
