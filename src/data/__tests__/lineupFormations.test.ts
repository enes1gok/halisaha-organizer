import {
  getLineupFormationById,
  LINEUP_FORMATIONS,
  getLineupFormationsForTotalPlayers,
  groupFormationSlotsByRow,
  resolveSlotAnchor,
} from '../lineupFormations';

describe('lineupFormations', () => {
  it('every formation has slots equal to half totalPlayers', () => {
    for (const f of LINEUP_FORMATIONS) {
      expect(f.slots.length).toBe(f.playersPerTeam);
      expect(f.playersPerTeam).toBe(f.totalPlayers / 2);
      expect(new Set(f.slots.map((s) => s.index)).size).toBe(f.slots.length);
    }
  });

  it('filters by total player count', () => {
    expect(getLineupFormationsForTotalPlayers(14).every((f) => f.totalPlayers === 14)).toBe(true);
    expect(getLineupFormationsForTotalPlayers(16).length).toBeGreaterThan(0);
    expect(getLineupFormationsForTotalPlayers(22).length).toBeGreaterThan(0);
  });

  it('groupFormationSlotsByRow covers all indices', () => {
    const f = LINEUP_FORMATIONS[0]!;
    const rows = groupFormationSlotsByRow(f);
    const flat = rows.flat();
    expect(flat.length).toBe(f.slots.length);
  });

  it('4-2-3-1 template exists with 11 slots and anchors', () => {
    const f = getLineupFormationById('f22-4231');
    expect(f).toBeDefined();
    expect(f!.label).toBe('4-2-3-1');
    expect(f!.slots.length).toBe(11);
    expect(f!.slots.every((s) => s.anchor != null)).toBe(true);
  });

  it('resolveSlotAnchor returns stored anchor for 4-2-3-1', () => {
    const f = getLineupFormationById('f22-4231')!;
    const kl = f.slots[0]!;
    const a = resolveSlotAnchor(kl, f);
    expect(a.xNorm).toBe(0.5);
    expect(a.yNorm).toBe(0.07);
  });

  it('resolveSlotAnchor row-col fallback for formations without anchor', () => {
    const f = getLineupFormationById('f14-231')!;
    const s0 = f.slots[0]!;
    expect(s0.anchor).toBeUndefined();
    const a = resolveSlotAnchor(s0, f);
    expect(a.yNorm).toBeCloseTo(0.125, 5);
    expect(a.xNorm).toBe(0.5);
  });
});
