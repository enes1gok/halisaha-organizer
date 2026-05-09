import React from 'react';
import { StyleSheet, View } from 'react-native';
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
  zonesRef: React.MutableRefObject<ZoneMap>;
  getPlayer: (id: string) => Player | undefined;
  /** İçerik: dolu/boş slot görünümü (DraggableCard vb.) */
  renderSlotContent: (
    slot: LineupSlotDef,
    player: Player | undefined,
    testID: string,
  ) => React.ReactNode;
  testID?: string;
};

/**
 * Dikdörtgen yarı saha: kale alt kenarda; üstte ince orta saha çizgisi.
 * Slotlar normalize anchor ile mutlak konumlanır.
 */
export function PitchHalfField({
  formation,
  slots,
  side,
  dimmed,
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
      <View style={styles.midfieldLine} accessibilityRole="none" />
      <View style={styles.slotLayer}>
        {formation.slots.map((slot) => {
          const { xNorm, yNorm } = resolveSlotAnchor(slot, formation);
          const pid = slots[slot.index];
          const p = pid ? getPlayer(pid) : undefined;
          const zoneKey = `${side}:${slot.index}`;
          const slotTestId = `lineup:slot:${side.toLowerCase()}:${slot.index}`;
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
              {renderSlotContent(slot, p, slotTestId)}
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
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
  },
  pitchDimmed: {
    opacity: 0.42,
  },
  midfieldLine: {
    position: 'absolute',
    top: 0,
    left: spacing.xs,
    right: spacing.xs,
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.85,
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
});
