import type { Match, Player, ScoreResult } from '../../types/domain';
import { emptyPlayerStats } from '../../store/helpers';
import {
  patchPlayersStatsForMatchTransition,
  recomputePlayerStatsFromMatches,
} from '../stats';

function basePlayer(id: string): Player {
  return {
    id,
    name: id,
    position: 'MID',
    preferredFoot: 'right',
    stats: emptyPlayerStats(),
  };
}

function finishedMatch(
  id: string,
  teamAIds: string[],
  teamBIds: string[],
  result: ScoreResult,
  startsAt = '2025-01-01T12:00:00.000Z',
): Match {
  return {
    id,
    startsAt,
    venue: 'X',
    organizerId: teamAIds[0] ?? 'o',
    maxPlayers: 14,
    joinCode: 'ABC',
    attendees: [],
    teamAIds,
    teamBIds,
    lineupLocked: false,
    selfReportEnabled: false,
    status: 'finished',
    selfReports: [],
    result,
  };
}

function assertMatchDerivedStatsEqual(a: Player[], b: Player[]) {
  const bm = new Map(b.map((p) => [p.id, p]));
  expect(a.length).toBe(b.length);
  for (const p of a) {
    const q = bm.get(p.id);
    expect(q).toBeDefined();
    expect(p.stats.matchesPlayed).toBe(q!.stats.matchesPlayed);
    expect(p.stats.goals).toBe(q!.stats.goals);
    expect(p.stats.assists).toBe(q!.stats.assists);
    expect(p.stats.wins).toBe(q!.stats.wins);
    expect(p.stats.losses).toBe(q!.stats.losses);
    expect(p.stats.draws).toBe(q!.stats.draws);
  }
}

describe('patchPlayersStatsForMatchTransition vs recomputePlayerStatsFromMatches', () => {
  it('ilk bitiş: önceki maç yokken tam yeniden hesaplama ile eşleşir', () => {
    const players = [basePlayer('a'), basePlayer('b')];
    const m = finishedMatch(
      'm1',
      ['a'],
      ['b'],
      { scoreA: 2, scoreB: 1, scorers: [{ playerId: 'a', count: 2 }], assists: [], ownGoals: [] },
    );
    const incremental = patchPlayersStatsForMatchTransition(players, undefined, m);
    const full = recomputePlayerStatsFromMatches(players, [m]);
    assertMatchDerivedStatsEqual(incremental, full);
  });

  it('bitmiş maç sonucunu düzenleme: önceki ve yeni hal ile tam yeniden hesaplama ile eşleşir', () => {
    const players = [basePlayer('a'), basePlayer('b')];
    const before = finishedMatch(
      'm1',
      ['a'],
      ['b'],
      { scoreA: 1, scoreB: 1, scorers: [], assists: [], ownGoals: [] },
    );
    const after = finishedMatch(
      'm1',
      ['a'],
      ['b'],
      { scoreA: 2, scoreB: 1, scorers: [{ playerId: 'a', count: 1 }], assists: [], ownGoals: [] },
    );
    const synced = recomputePlayerStatsFromMatches(players, [before]);
    const incremental = patchPlayersStatsForMatchTransition(synced, before, after);
    const full = recomputePlayerStatsFromMatches(players, [after]);
    assertMatchDerivedStatsEqual(incremental, full);
  });

  it('kadroda olmayan golcü: tam yeniden hesaplama ile eşleşir', () => {
    const players = [basePlayer('a'), basePlayer('b'), basePlayer('c')];
    const m = finishedMatch(
      'm1',
      ['a'],
      ['b'],
      {
        scoreA: 1,
        scoreB: 0,
        scorers: [{ playerId: 'c', count: 1 }],
        assists: [],
        ownGoals: [],
      },
    );
    const incremental = patchPlayersStatsForMatchTransition(players, undefined, m);
    const full = recomputePlayerStatsFromMatches(players, [m]);
    assertMatchDerivedStatsEqual(incremental, full);
  });

  it('ardışık iki geçiş tek tam yeniden hesaplama ile eşleşir', () => {
    const players = [basePlayer('a'), basePlayer('b')];
    const m1 = finishedMatch(
      'm1',
      ['a'],
      ['b'],
      { scoreA: 1, scoreB: 0, scorers: [{ playerId: 'a', count: 1 }], assists: [], ownGoals: [] },
      '2025-01-01T12:00:00.000Z',
    );
    const m2 = finishedMatch(
      'm2',
      ['a'],
      ['b'],
      { scoreA: 0, scoreB: 1, scorers: [{ playerId: 'b', count: 1 }], assists: [], ownGoals: [] },
      '2025-01-02T12:00:00.000Z',
    );
    let cur = players;
    cur = patchPlayersStatsForMatchTransition(cur, undefined, m1);
    cur = patchPlayersStatsForMatchTransition(cur, undefined, m2);
    const full = recomputePlayerStatsFromMatches(players, [m2, m1]);
    assertMatchDerivedStatsEqual(cur, full);
  });

  it('rating alanlarını yama sonrası korur', () => {
    const players: Player[] = [
      {
        ...basePlayer('a'),
        stats: { ...emptyPlayerStats(), ratingAverage100: 75, ratingVoteCount: 3, motmCount: 1 },
      },
      basePlayer('b'),
    ];
    const m = finishedMatch(
      'm1',
      ['a'],
      ['b'],
      { scoreA: 1, scoreB: 0, scorers: [], assists: [], ownGoals: [] },
    );
    const out = patchPlayersStatsForMatchTransition(players, undefined, m);
    const pa = out.find((p) => p.id === 'a');
    expect(pa?.stats.ratingAverage100).toBe(75);
    expect(pa?.stats.ratingVoteCount).toBe(3);
    expect(pa?.stats.motmCount).toBe(1);
  });
});
