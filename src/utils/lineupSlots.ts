/** Kadro şablon slotları: yerel UI durumu; kalıcı maçta `teamAIds` / `teamBIds` compact dizileri. */

export function buildSlotsFromCompact(teamIds: string[], slotCount: number): (string | null)[] {
  const out: (string | null)[] = Array.from({ length: slotCount }, () => null);
  for (let i = 0; i < Math.min(teamIds.length, slotCount); i += 1) {
    out[i] = teamIds[i] ?? null;
  }
  return out;
}

export function compactSlots(slots: readonly (string | null | undefined)[]): string[] {
  return slots.filter((id): id is string => id != null && id !== '');
}
