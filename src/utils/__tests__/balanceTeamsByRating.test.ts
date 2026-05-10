import { getLineupFormationById } from '../../data/lineupFormations';
import type { Player, Position } from '../../types/domain';
import {
  balanceClassicTeamsByRating,
  balanceFormationSlotsByRating,
  comparePlayersForSlotFill,
  DEFAULT_EFFECTIVE_RATING,
  effectiveRating,
  balancePlayerIdsIntoTwoTeams,
  selectPlayersForFormationField,
} from '../balanceTeamsByRating';

function player(
  id: string,
  name: string,
  position: Position,
  rating?: number,
): Player {
  return {
    id,
    name,
    position,
    preferredFoot: 'right',
    stats: {
      matchesPlayed: 0,
      goals: 0,
      assists: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      ...(rating != null ? { ratingAverage100: rating } : {}),
    },
  };
}

describe('effectiveRating', () => {
  it('uses neutral when rating missing', () => {
    expect(effectiveRating(player('a', 'A', 'MID'))).toBe(DEFAULT_EFFECTIVE_RATING);
  });

  it('clamps to 0–100', () => {
    expect(effectiveRating(player('a', 'A', 'MID', -5))).toBe(0);
    expect(effectiveRating(player('a', 'A', 'MID', 150))).toBe(100);
  });
});

describe('balancePlayerIdsIntoTwoTeams', () => {
  it('balances sum for four players with symmetric ratings', () => {
    const players = [
      player('a', 'a', 'MID', 90),
      player('b', 'b', 'MID', 90),
      player('c', 'c', 'MID', 10),
      player('d', 'd', 'MID', 10),
    ];
    const { A, B } = balancePlayerIdsIntoTwoTeams(players);
    expect(A.length).toBe(2);
    expect(B.length).toBe(2);
    const sum = (ids: string[]) =>
      ids.reduce((s, id) => s + effectiveRating(players.find((p) => p.id === id)!), 0);
    expect(sum(A)).toBe(sum(B));
  });

  it('is deterministic for equal ratings', () => {
    const players = [
      player('id1', 'Z', 'MID', 50),
      player('id2', 'Y', 'MID', 50),
      player('id3', 'X', 'MID', 50),
      player('id4', 'W', 'MID', 50),
    ];
    const r1 = balancePlayerIdsIntoTwoTeams(players);
    const r2 = balancePlayerIdsIntoTwoTeams(players);
    expect(r1.A).toEqual(r2.A);
    expect(r1.B).toEqual(r2.B);
  });

  it('handles odd count with capacity split', () => {
    const players = [
      player('a', 'a', 'MID', 80),
      player('b', 'b', 'MID', 60),
      player('c', 'c', 'MID', 40),
    ];
    const { A, B } = balancePlayerIdsIntoTwoTeams(players);
    expect(A.length).toBe(2);
    expect(B.length).toBe(1);
    expect(new Set([...A, ...B]).size).toBe(3);
  });
});

describe('balanceClassicTeamsByRating', () => {
  it('delegates to partition helper', () => {
    const players = [player('a', 'a', 'GK', 99), player('b', 'b', 'FWD', 1)];
    const { A, B } = balanceClassicTeamsByRating(players);
    expect([...A, ...B].sort()).toEqual(['a', 'b'].sort());
    expect(A.length).toBe(1);
    expect(B.length).toBe(1);
  });
});

describe('selectPlayersForFormationField', () => {
  it('takes top 2P by rating when roster overflows', () => {
    const formation = getLineupFormationById('f14-231')!;
    const p = formation.playersPerTeam;
    const players: Player[] = [];
    for (let i = 0; i < 16; i += 1) {
      players.push(player(`p${i}`, `n${i}`, 'MID', i * 5));
    }
    const field = selectPlayersForFormationField(players, p);
    expect(field.length).toBe(p * 2);
    const ratings = field.map((x) => effectiveRating(x)).sort((a, b) => b - a);
    const topRatings = [...players]
      .sort((a, b) => effectiveRating(b) - effectiveRating(a))
      .slice(0, p * 2)
      .map((x) => effectiveRating(x))
      .sort((a, b) => b - a);
    expect(ratings).toEqual(topRatings);
  });
});

describe('balanceFormationSlotsByRating', () => {
  it('fills exactly playersPerTeam per side when count matches', () => {
    const formation = getLineupFormationById('f14-231')!;
    const n = formation.playersPerTeam;
    const players: Player[] = [];
    for (let i = 0; i < 14; i += 1) {
      players.push(player(`p${i}`, `n${i}`, i % 2 === 0 ? 'GK' : 'DEF', 40 + i));
    }
    const { slotsA, slotsB } = balanceFormationSlotsByRating(players, formation);
    expect(slotsA.filter(Boolean)).toHaveLength(n);
    expect(slotsB.filter(Boolean)).toHaveLength(n);
    const onField = new Set([
      ...slotsA.filter((x): x is string => x != null),
      ...slotsB.filter((x): x is string => x != null),
    ]);
    expect(onField.size).toBe(14);
  });

  it('overflow leaves extras off slots (top 2P by rating)', () => {
    const formation = getLineupFormationById('f14-231')!;
    const players: Player[] = [];
    for (let i = 0; i < 16; i += 1) {
      players.push(player(`p${i}`, `n${i}`, 'MID', i));
    }
    const { slotsA, slotsB } = balanceFormationSlotsByRating(players, formation);
    const assigned = new Set([
      ...compact(slotsA),
      ...compact(slotsB),
    ]);
    expect(assigned.size).toBe(14);
    expect(assigned.has('p0')).toBe(false);
    expect(assigned.has('p1')).toBe(false);
  });
});

describe('comparePlayersForSlotFill', () => {
  it('orders GK before FWD, then name', () => {
    const gk = player('a', 'Z', 'GK', 50);
    const fwd = player('b', 'A', 'FWD', 50);
    expect(comparePlayersForSlotFill(gk, fwd)).toBeLessThan(0);
    expect(comparePlayersForSlotFill(fwd, gk)).toBeGreaterThan(0);
  });
});

function compact(slots: (string | null)[]): string[] {
  return slots.filter((x): x is string => x != null);
}
