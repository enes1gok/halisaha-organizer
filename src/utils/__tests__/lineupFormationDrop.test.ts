import {
  applyLineupFormationDrop,
  findPlayerSlotSource,
  pickFormationZoneOrdered,
} from '../lineupFormationDrop';

describe('lineupFormationDrop', () => {
  describe('findPlayerSlotSource', () => {
    it('finds bench when player not in slots', () => {
      expect(findPlayerSlotSource(['a', null], [null, 'b'], 'x')).toBe('bench');
    });
    it('finds A side', () => {
      expect(findPlayerSlotSource(['p', null], [null, null], 'p')).toEqual({
        side: 'A',
        index: 0,
      });
    });
    it('finds B side', () => {
      expect(findPlayerSlotSource([null, null], [null, 'q'], 'q')).toEqual({
        side: 'B',
        index: 1,
      });
    });
  });

  describe('applyLineupFormationDrop', () => {
    it('moves from bench to empty slot', () => {
      const r = applyLineupFormationDrop([null, null], [null, null], 'p', 'A:0');
      expect(r?.changed).toBe(true);
      expect(r?.slotsA[0]).toBe('p');
      expect(r?.slotsB.every((x) => x == null)).toBe(true);
    });

    it('bench zone clears slot', () => {
      const r = applyLineupFormationDrop(['p', null], [null, null], 'p', 'bench');
      expect(r?.changed).toBe(true);
      expect(r?.slotsA[0]).toBeNull();
    });

    it('swaps two slot occupants', () => {
      const r = applyLineupFormationDrop(['p', null], [null, 'q'], 'p', 'B:1');
      expect(r?.changed).toBe(true);
      expect(r?.slotsA[0]).toBe('q');
      expect(r?.slotsB[1]).toBe('p');
    });

    it('bench onto occupied slot displaces other to bench', () => {
      const r = applyLineupFormationDrop([null, null], ['q', null], 'p', 'B:0');
      expect(r?.changed).toBe(true);
      expect(r?.slotsB[0]).toBe('p');
      expect(compactCount(r!.slotsA) + compactCount(r!.slotsB)).toBe(1);
    });

    it('no-op when dropping on same slot', () => {
      const r = applyLineupFormationDrop(['p', null], [null, null], 'p', 'A:0');
      expect(r?.changed).toBe(false);
    });

    it('returns null for invalid zone', () => {
      expect(applyLineupFormationDrop([null], [null], 'p', 'Z:0')).toBeNull();
    });
  });

  describe('pickFormationZoneOrdered', () => {
    it('prefers slot hit over overlapping bench', () => {
      const zones = new Map([
        ['bench', { x: 0, y: 0, w: 400, h: 800 }],
        ['A:1', { x: 50, y: 50, w: 60, h: 60 }],
      ]);
      expect(pickFormationZoneOrdered(zones, 70, 70)).toBe('A:1');
    });
  });
});

function compactCount(slots: (string | null)[]): number {
  return slots.filter((x): x is string => x != null).length;
}
