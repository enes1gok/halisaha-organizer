# Skill: add-formation-logic

Use when adding or changing **tactical lineup formations** (7 / 8 / 11 per team → total 14 / 16 / 22) in Halisaha Organizer.

## Preconditions

- Formations live in [`src/data/lineupFormations.ts`](src/data/lineupFormations.ts).
- Pitch rendering uses `resolveSlotAnchor` and percentage positioning in [`src/components/PitchHalfField.tsx`](src/components/PitchHalfField.tsx).
- Match capacity is `match.maxPlayers`; template mode is enabled for **14, 16, 22** only.

## Steps

### 1. Coordinate map

- Decide **players per team** = `maxPlayers / 2` (must be 7, 8, or 11 for built-in tactical mode).
- For each slot, either:
  - **Row/column grid:** use `slotsFromRows` (implicit anchors), or
  - **Explicit anchors:** set `anchor: { xNorm, yNorm }` with **bottom-origin** `yNorm` (goal line = low `yNorm`, attack = higher `yNorm`) per existing convention in file comments.

### 2. `LineupFormation` object

- `id`: stable string, e.g. `f14-xyz`.
- `label`: short display string (e.g. `3-2-1`).
- `totalPlayers`: **twice** `playersPerTeam`.
- `slots`: length === `playersPerTeam`, unique `index` **0 … n-1**.

### 3. Register in `LINEUP_FORMATIONS`

- Append to the correct array (`FORMATIONS_14`, `FORMATIONS_16`, or `FORMATIONS_22`) or add a factory like `formation4231()`.

### 4. Validation

- Run / extend [`src/data/__tests__/lineupFormations.test.ts`](src/data/__tests__/lineupFormations.test.ts) (invariants already assert counts and indices).
- Manually verify on device: slots don’t overlap unreadably; labels fit inside slot rings.

### 5. Business rules

- **No DB migration** for new shapes: only `lineupFormationId` + ordered team arrays.
- Drop/swap logic is centralized in [`src/utils/lineupFormationDrop.ts`](src/utils/lineupFormationDrop.ts) — do not duplicate in the screen.

## Checklist

- [ ] `slots.length === playersPerTeam === totalPlayers / 2`
- [ ] `getLineupFormationsForTotalPlayers(totalPlayers)` returns the new formation
- [ ] Tests pass (`npm test -- lineupFormations`)
- [ ] Governing rule: [`.cursor/rules/tactical-board-governance.mdc`](.cursor/rules/tactical-board-governance.mdc)
