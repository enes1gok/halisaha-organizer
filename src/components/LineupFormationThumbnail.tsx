import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LineupFormation, LineupSlotDef } from '../data/lineupFormations';
import { resolveSlotAnchor } from '../data/lineupFormations';
import { radius, spacing } from '../theme';
import { makeStyles, useThemeColors } from '../theme/ThemeContext';

/** PitchHalfField ile aynı hizalama (chip merkezi ↔ anchor). */
const SLOT_CENTER_OFFSET_X = 40;
const SLOT_CENTER_OFFSET_Y = 28;

function PitchMarkings() {
  const { pitch } = useThemeColors();
  const styles = useMarkingStyles();
  const line = pitch.line;
  const strong = pitch.lineStrong;
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

function ThumbnailHalf({ formation, side }: { formation: LineupFormation; side: 'A' | 'B' }) {
  const styles = useThumbnailStyles();
  const { pitch } = useThemeColors();

  return (
    <View
      style={styles.pitchOuter}
      accessibilityLabel={`${side === 'B' ? 'Siyah' : 'Beyaz'} takım formasyon önizlemesi`}
    >
      <LinearGradient
        colors={[pitch.grassDeep, pitch.grassMid, pitch.grassLight]}
        start={{ x: 0.2, y: 1 }}
        end={{ x: 0.85, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.grassNoise} pointerEvents="none" />
      <PitchMarkings />
      <View style={styles.slotLayer} pointerEvents="none">
        {formation.slots.map((slot: LineupSlotDef) => {
          const { xNorm, yNorm } = resolveSlotAnchor(slot, formation);
          return (
            <View
              key={`${side}-${slot.index}`}
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
              <View style={styles.slotRing}>
                <Text style={styles.slotRole} numberOfLines={1}>
                  {slot.roleLabel}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

type Props = {
  formation: LineupFormation;
  /** Ana ekrandaki sıra: solda Siyah (B), sağda Beyaz (A) */
  teamLabelB: string;
  teamLabelA: string;
  testID?: string;
};

/**
 * Sürükleme bölgeleri kaydetmez; yalnızca seçili formasyonun slot geometrisini gösterir.
 */
export function LineupFormationThumbnail({ formation, teamLabelB, teamLabelA, testID }: Props) {
  const styles = useThumbnailStyles();

  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.col}>
        <Text style={styles.teamCaption} numberOfLines={1}>
          {teamLabelB}
        </Text>
        <ThumbnailHalf formation={formation} side="B" />
      </View>
      <View style={styles.col}>
        <Text style={styles.teamCaption} numberOfLines={1}>
          {teamLabelA}
        </Text>
        <ThumbnailHalf formation={formation} side="A" />
      </View>
    </View>
  );
}

const useMarkingStyles = makeStyles(() =>
  StyleSheet.create({
    markTop: {
      position: 'absolute',
      top: 0,
      left: spacing.xs,
      right: spacing.xs,
      height: 2,
      opacity: 0.95,
    },
    markBottom: {
      position: 'absolute',
      bottom: 0,
      left: spacing.xs,
      right: spacing.xs,
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
      width: 40,
      height: 20,
      marginLeft: -20,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderWidth: 1,
      borderBottomWidth: 0,
      opacity: 0.55,
    },
  }),
);

const useThumbnailStyles = makeStyles((t) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'stretch',
      minHeight: 112,
    },
    col: {
      flex: 1,
      gap: spacing.xs,
    },
    teamCaption: {
      fontSize: 11,
      fontWeight: '500',
      fontFamily: 'Inter_600SemiBold',
      color: t.colors.textMuted,
      textAlign: 'center',
    },
    pitchOuter: {
      position: 'relative',
      width: '100%',
      aspectRatio: 3 / 4,
      minHeight: 88,
      maxHeight: 104,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      overflow: 'hidden',
    },
    grassNoise: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.06)',
    },
    slotLayer: {
      ...StyleSheet.absoluteFillObject,
    },
    slotAbs: {
      position: 'absolute',
      minWidth: 56,
      maxWidth: 88,
      alignItems: 'center',
    },
    slotRing: {
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: t.colors.pitch.slotRing,
      backgroundColor: t.colors.pitch.slotFill,
      paddingVertical: 2,
      paddingHorizontal: 4,
      minWidth: 44,
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    slotRole: {
      fontSize: 9,
      fontWeight: '600',
      fontFamily: 'Inter_600SemiBold',
      color: t.colors.textMuted,
      textAlign: 'center',
    },
  }),
);
