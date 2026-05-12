import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { LineupFormation, LineupSlotDef } from '../data/lineupFormations';
import { resolveSlotAnchor } from '../data/lineupFormations';
import { radius, spacing } from '../theme';
import { makeStyles, useThemeColors } from '../theme/ThemeContext';
import type { Player } from '../types/domain';
import { Springs } from '../utils/animations';
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
  /** Şu an sürükleme ile hedeflenen slot anahtarı (ör. "A:2") */
  hoveredZoneKey?: string | null;
  /** flex: 1 ile ebeveyn boyutuna uyar; horizontal modda aspectRatio kısıtını kaldırır */
  stretch?: boolean;
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
  /** Takım rengine göre saha: 'light' = bembeyaz zemin, 'dark' = simsiyah zemin; her ikisinde çizgiler ve çerçeve yeşil. */
  teamTint?: 'light' | 'dark';
};

function SlotDropHighlight({
  empty,
  dragActive,
  hovered,
  reduceMotion,
  teamTint,
  children,
}: {
  empty: boolean;
  dragActive: boolean;
  hovered: boolean;
  reduceMotion: boolean;
  teamTint?: 'light' | 'dark';
  children: React.ReactNode;
}) {
  const styles = usePitchStyles();
  const colors = useThemeColors();
  const idlePulse = useSharedValue(0);
  const hoverGlow = useSharedValue(0);

  useEffect(() => {
    if (!dragActive || !empty || reduceMotion) {
      idlePulse.value = 0;
      hoverGlow.value = 0;
      return;
    }
    if (hovered) {
      idlePulse.value = 0;
      hoverGlow.value = withSpring(1, Springs.snappy);
    } else {
      hoverGlow.value = withSpring(0, Springs.snappy);
      idlePulse.value = withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    }
  }, [dragActive, hovered, empty, reduceMotion, idlePulse, hoverGlow]);

  // Takım sahasına göre halka renkleri
  const teamRing = teamTint === 'light'
    ? { border: 'rgba(30,30,30,0.80)', fill: 'rgba(50,50,50,0.72)' }
    : teamTint === 'dark'
    ? { border: 'rgba(190,190,190,0.75)', fill: 'rgba(140,140,140,0.55)' }
    : null;

  const ringStyle = useAnimatedStyle(() => {
    const baseBorder = teamRing ? teamRing.border : colors.pitch.slotRing;
    const hoverBorder = teamRing ? teamRing.border : colors.pitch.slotRingHover;
    if (!dragActive || !empty) {
      return { borderColor: baseBorder, shadowOpacity: 0 };
    }
    if (reduceMotion) {
      return {
        borderColor: hovered ? hoverBorder : baseBorder,
        shadowOpacity: hovered ? 0.60 : 0.20,
        borderWidth: hovered ? 2.5 : 2,
      };
    }
    const h = hoverGlow.value;
    const p = idlePulse.value;
    return {
      borderColor: h > 0.5 ? hoverBorder : baseBorder,
      shadowOpacity: 0.08 + p * 0.12 + h * 0.45,
      borderWidth: 2 + h * 1,
    };
  });

  const filledStyle = teamRing
    ? { borderColor: teamRing.border, backgroundColor: teamRing.fill, shadowOpacity: 0 as const }
    : styles.slotRingFilled;

  const teamFillOverride = teamRing && empty
    ? { backgroundColor: teamRing.fill }
    : undefined;

  return (
    <Animated.View
      style={[
        styles.slotRing,
        empty ? [ringStyle, teamFillOverride] : filledStyle,
      ]}
    >
      {children}
    </Animated.View>
  );
}

const TEAM_LINE_GREEN = '#3DDC6A';

function PitchMarkings({
  horizontal,
  lineColor,
  strongColor,
}: {
  horizontal?: boolean;
  lineColor?: string;
  strongColor?: string;
}) {
  const styles = usePitchStyles();
  const { pitch } = useThemeColors();
  const line = lineColor ?? pitch.line;
  const strong = strongColor ?? pitch.lineStrong;

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
  hoveredZoneKey = null,
  stretch = false,
  reduceMotion = false,
  zonesRef,
  getPlayer,
  renderSlotContent,
  testID,
  horizontal = false,
  teamTint,
}: Props) {
  const styles = usePitchStyles();
  const { pitch } = useThemeColors();

  // pitchOuter base'inde aspectRatio yok — tüm boyut kısıtları burada yönetilir
  const containerOverride = horizontal
    ? stretch
      ? ({ flex: 1, minHeight: 80 } as const)
      : ({ aspectRatio: 4 / 3, minHeight: 120 } as const)
    : ({ aspectRatio: 3 / 4, minHeight: 200 } as const);

  const teamBorderStyle = teamTint
    ? ({ borderColor: TEAM_LINE_GREEN } as const)
    : undefined;
  const teamBgStyle = teamTint
    ? ({ backgroundColor: teamTint === 'light' ? '#FFFFFF' : '#000000' } as const)
    : undefined;

  return (
    <View
      style={[styles.pitchOuter, containerOverride, dimmed && styles.pitchDimmed, teamBorderStyle]}
      pointerEvents={dimmed ? 'none' : 'auto'}
      testID={testID}
    >
      {teamTint ? (
        <View style={[StyleSheet.absoluteFill, teamBgStyle]} />
      ) : (
        <LinearGradient
          colors={[pitch.grassDeep, pitch.grassMid, pitch.grassLight]}
          start={{ x: 0.2, y: 1 }}
          end={{ x: 0.85, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {!teamTint && <View style={styles.grassNoise} pointerEvents="none" />}
      <PitchMarkings
        horizontal={horizontal}
        lineColor={teamTint ? TEAM_LINE_GREEN : undefined}
        strongColor={teamTint ? TEAM_LINE_GREEN : undefined}
      />
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
                dragActive={highlightEmptySlots}
                hovered={hoveredZoneKey === zoneKey}
                reduceMotion={reduceMotion}
                teamTint={teamTint}
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
      // aspectRatio ve minHeight containerOverride içinde yönetilir
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
  }),
);
