/** Pure drop/swap logic for tactical lineup slots (tests cover edge cases). */

export type LineupSlotSource = 'bench' | { side: 'A' | 'B'; index: number };

export type LineupFormationZone =
  | 'bench'
  | { kind: 'slot'; side: 'A' | 'B'; index: number };

export function findPlayerSlotSource(
  slotsA: readonly (string | null)[],
  slotsB: readonly (string | null)[],
  playerId: string,
): LineupSlotSource {
  for (let i = 0; i < slotsA.length; i += 1) {
    if (slotsA[i] === playerId) return { side: 'A', index: i };
  }
  for (let i = 0; i < slotsB.length; i += 1) {
    if (slotsB[i] === playerId) return { side: 'B', index: i };
  }
  return 'bench';
}

export function parseFormationDropZone(zone: string | null): LineupFormationZone | null {
  if (zone == null) return null;
  if (zone === 'bench') return 'bench';
  const m = /^([AB]):(\d+)$/.exec(zone);
  if (!m) return null;
  return { kind: 'slot', side: m[1] as 'A' | 'B', index: Number(m[2]) };
}

export function applyLineupFormationDrop(
  slotsA: (string | null)[],
  slotsB: (string | null)[],
  playerId: string,
  zone: string | null,
): { slotsA: (string | null)[]; slotsB: (string | null)[]; changed: boolean } | null {
  const parsed = parseFormationDropZone(zone);
  if (!parsed) return null;

  const src = findPlayerSlotSource(slotsA, slotsB, playerId);

  if (parsed === 'bench') {
    if (src === 'bench') return { slotsA, slotsB, changed: false };
    const nextA = slotsA.map((s) => (s === playerId ? null : s));
    const nextB = slotsB.map((s) => (s === playerId ? null : s));
    return { slotsA: nextA, slotsB: nextB, changed: true };
  }

  const { side: tSide, index: tIdx } = parsed;
  const occupant =
    tSide === 'A' ? slotsA[tIdx] ?? null : slotsB[tIdx] ?? null;

  if (occupant === playerId) {
    return { slotsA, slotsB, changed: false };
  }

  let nextA = slotsA.map((s) => (s === playerId ? null : s));
  let nextB = slotsB.map((s) => (s === playerId ? null : s));

  if (occupant && occupant !== playerId) {
    if (src !== 'bench') {
      if (src.side === 'A') nextA[src.index] = occupant;
      else nextB[src.index] = occupant;
    }
  }

  if (tSide === 'A') nextA[tIdx] = playerId;
  else nextB[tIdx] = playerId;

  return { slotsA: nextA, slotsB: nextB, changed: true };
}

/**
 * Pick drop zone from measured rects; slot zones win over bench so overlaps resolve to the pitch.
 */
export function pickFormationZoneOrdered(
  zones: Map<string, { x: number; y: number; w: number; h: number }>,
  absX: number,
  absY: number,
): string | null {
  const entries = [...zones.entries()].filter(([, r]) =>
    absX >= r.x && absX <= r.x + r.w && absY >= r.y && absY <= r.y + r.h,
  );
  if (entries.length === 0) return null;
  const slotHit = entries.find(([k]) => /^[AB]:\d+$/.test(k));
  if (slotHit) return slotHit[0];
  const benchHit = entries.find(([k]) => k === 'bench');
  if (benchHit) return 'bench';
  return entries[0]![0];
}
