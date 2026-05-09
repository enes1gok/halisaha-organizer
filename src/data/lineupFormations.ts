/**
 * Halısaha kadro şablonları: toplam oyuncu (14 / 16 / 22) ve takım başına slot düzeni.
 * Satır numarası: 0 = kale çizgisi (GK), üst satırlar hücum tarafı.
 *
 * anchor: sol-alt köşe (0,0), sağ-üst (1,1); kale alt kenara yakın düşük yNorm.
 */

export type SlotAnchor = {
  /** 0–1 yatay merkez */
  xNorm: number;
  /** 0–1 dikey merkez (alttan) */
  yNorm: number;
};

export type LineupSlotDef = {
  /** teamAIds / teamBIds içindeki sabit indeks (0..playersPerTeam-1) */
  index: number;
  /** Dikey konum; 0 kale */
  row: number;
  /** Aynı satırda soldan sağa sıra */
  col: number;
  /** Kısa Türkçe rol etiketi */
  roleLabel: string;
  /** Yarı saha dikdörtgeninde konum; yoksa row/col ile hesaplanır */
  anchor?: SlotAnchor;
};

export type LineupFormation = {
  id: string;
  /** Örn. "2-3-1" */
  label: string;
  /** Toplam katılımcı (iki takım) */
  totalPlayers: number;
  playersPerTeam: number;
  slots: LineupSlotDef[];
};

function slotsFromRows(
  rows: { roleLabel: string }[][],
  totalPlayers: number,
  label: string,
  id: string,
): LineupFormation {
  const slots: LineupSlotDef[] = [];
  let index = 0;
  rows.forEach((rowSlots, rowIdx) => {
    rowSlots.forEach((s, colIdx) => {
      slots.push({
        index,
        row: rowIdx,
        col: colIdx,
        roleLabel: s.roleLabel,
      });
      index += 1;
    });
  });
  return {
    id,
    label,
    totalPlayers,
    playersPerTeam: totalPlayers / 2,
    slots,
  };
}

/**
 * anchor yoksa satır/sütun ile deterministik konum (kale alt, hücum üst).
 */
export function resolveSlotAnchor(slot: LineupSlotDef, formation: LineupFormation): SlotAnchor {
  if (slot.anchor) {
    return slot.anchor;
  }
  const maxRow = Math.max(...formation.slots.map((s) => s.row), 0);
  const rowCount = maxRow + 1;
  const rowPeers = formation.slots.filter((s) => s.row === slot.row).sort((a, b) => a.col - b.col);
  const n = rowPeers.length;
  const colIndex = Math.max(
    0,
    rowPeers.findIndex((s) => s.index === slot.index),
  );
  const yNorm = (slot.row + 0.5) / rowCount;
  const xNorm = n > 0 ? (colIndex + 0.5) / n : 0.5;
  return { xNorm, yNorm };
}

/** 7’li (toplam 14) şablonlar */
const FORMATIONS_14: LineupFormation[] = [
  slotsFromRows(
    [
      [{ roleLabel: 'KL' }],
      [{ roleLabel: 'SLB' }, { roleLabel: 'STP' }],
      [{ roleLabel: 'SOL' }, { roleLabel: 'OOS' }, { roleLabel: 'SAĞ' }],
      [{ roleLabel: 'SF' }],
    ],
    14,
    '2-3-1',
    'f14-231',
  ),
  slotsFromRows(
    [
      [{ roleLabel: 'KL' }],
      [{ roleLabel: 'SLB' }, { roleLabel: 'STP' }, { roleLabel: 'SAB' }],
      [{ roleLabel: 'OOS' }, { roleLabel: 'OOS' }],
      [{ roleLabel: 'SF' }],
    ],
    14,
    '3-2-1',
    'f14-321',
  ),
  slotsFromRows(
    [
      [{ roleLabel: 'KL' }],
      [{ roleLabel: 'DEF' }, { roleLabel: 'DEF' }],
      [{ roleLabel: 'OOS' }, { roleLabel: 'OOS' }],
      [{ roleLabel: 'SF' }, { roleLabel: 'SF' }],
    ],
    14,
    '2-2-2',
    'f14-222',
  ),
];

/** 8’li (toplam 16) şablonlar */
const FORMATIONS_16: LineupFormation[] = [
  slotsFromRows(
    [
      [{ roleLabel: 'KL' }],
      [{ roleLabel: 'DEF' }, { roleLabel: 'DEF' }, { roleLabel: 'DEF' }],
      [{ roleLabel: 'OOS' }, { roleLabel: 'OOS' }, { roleLabel: 'OOS' }],
      [{ roleLabel: 'SF' }],
    ],
    16,
    '3-3-1',
    'f16-331',
  ),
  slotsFromRows(
    [
      [{ roleLabel: 'KL' }],
      [{ roleLabel: 'DEF' }, { roleLabel: 'DEF' }],
      [{ roleLabel: 'OOS' }, { roleLabel: 'OOS' }, { roleLabel: 'OOS' }],
      [{ roleLabel: 'SF' }, { roleLabel: 'SF' }],
    ],
    16,
    '2-3-2',
    'f16-232',
  ),
];

/** 4-2-3-1 (11’li): KL + 4 savunma + 2 ön libero + 3 hücum orta + forvet */
function formation4231(): LineupFormation {
  const slots: LineupSlotDef[] = [
    { index: 0, row: 0, col: 0, roleLabel: 'KL', anchor: { xNorm: 0.5, yNorm: 0.07 } },
    { index: 1, row: 1, col: 0, roleLabel: 'DEF', anchor: { xNorm: 0.11, yNorm: 0.22 } },
    { index: 2, row: 1, col: 1, roleLabel: 'DEF', anchor: { xNorm: 0.37, yNorm: 0.22 } },
    { index: 3, row: 1, col: 2, roleLabel: 'DEF', anchor: { xNorm: 0.63, yNorm: 0.22 } },
    { index: 4, row: 1, col: 3, roleLabel: 'DEF', anchor: { xNorm: 0.89, yNorm: 0.22 } },
    { index: 5, row: 2, col: 0, roleLabel: 'DOS', anchor: { xNorm: 0.34, yNorm: 0.4 } },
    { index: 6, row: 2, col: 1, roleLabel: 'DOS', anchor: { xNorm: 0.66, yNorm: 0.4 } },
    { index: 7, row: 3, col: 0, roleLabel: 'OOS', anchor: { xNorm: 0.18, yNorm: 0.58 } },
    { index: 8, row: 3, col: 1, roleLabel: 'OOS', anchor: { xNorm: 0.5, yNorm: 0.58 } },
    { index: 9, row: 3, col: 2, roleLabel: 'OOS', anchor: { xNorm: 0.82, yNorm: 0.58 } },
    { index: 10, row: 4, col: 0, roleLabel: 'SF', anchor: { xNorm: 0.5, yNorm: 0.78 } },
  ];
  return {
    id: 'f22-4231',
    label: '4-2-3-1',
    totalPlayers: 22,
    playersPerTeam: 11,
    slots,
  };
}

/** 11’li (toplam 22) şablonlar */
const FORMATIONS_22: LineupFormation[] = [
  slotsFromRows(
    [
      [{ roleLabel: 'KL' }],
      [{ roleLabel: 'DEF' }, { roleLabel: 'DEF' }, { roleLabel: 'DEF' }, { roleLabel: 'DEF' }],
      [{ roleLabel: 'OOS' }, { roleLabel: 'OOS' }, { roleLabel: 'OOS' }, { roleLabel: 'OOS' }],
      [{ roleLabel: 'SF' }, { roleLabel: 'SF' }],
    ],
    22,
    '4-4-2',
    'f22-442',
  ),
  slotsFromRows(
    [
      [{ roleLabel: 'KL' }],
      [{ roleLabel: 'DEF' }, { roleLabel: 'DEF' }, { roleLabel: 'DEF' }],
      [{ roleLabel: 'OOS' }, { roleLabel: 'OOS' }, { roleLabel: 'OOS' }, { roleLabel: 'OOS' }],
      [{ roleLabel: 'SF' }, { roleLabel: 'SF' }, { roleLabel: 'SF' }],
    ],
    22,
    '3-4-3',
    'f22-343',
  ),
  slotsFromRows(
    [
      [{ roleLabel: 'KL' }],
      [{ roleLabel: 'DEF' }, { roleLabel: 'DEF' }, { roleLabel: 'DEF' }, { roleLabel: 'DEF' }],
      [{ roleLabel: 'OOS' }, { roleLabel: 'OOS' }, { roleLabel: 'OOS' }],
      [{ roleLabel: 'SF' }, { roleLabel: 'SF' }, { roleLabel: 'SF' }],
    ],
    22,
    '4-3-3',
    'f22-433',
  ),
  formation4231(),
];

export const LINEUP_FORMATIONS: LineupFormation[] = [
  ...FORMATIONS_14,
  ...FORMATIONS_16,
  ...FORMATIONS_22,
];

export function getLineupFormationById(id: string): LineupFormation | undefined {
  return LINEUP_FORMATIONS.find((f) => f.id === id);
}

export function getLineupFormationsForTotalPlayers(total: number): LineupFormation[] {
  return LINEUP_FORMATIONS.filter((f) => f.totalPlayers === total);
}

/** Satır numarasına göre üstten alta (hücum → kale) slot grupları */
export function groupFormationSlotsByRow(formation: LineupFormation): LineupSlotDef[][] {
  const maxRow = Math.max(...formation.slots.map((s) => s.row), 0);
  const rows: LineupSlotDef[][] = [];
  for (let r = maxRow; r >= 0; r -= 1) {
    const inRow = formation.slots
      .filter((s) => s.row === r)
      .sort((a, b) => a.col - b.col);
    if (inRow.length) rows.push(inRow);
  }
  return rows;
}
