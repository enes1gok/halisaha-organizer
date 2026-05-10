import type { Match } from '../../types/domain';
import { getMatchContribution, sortPeersByMatchContribution } from '../matchPlayerContribution';

function baseMatch(over: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    startsAt: new Date().toISOString(),
    venue: 'Saha',
    organizerId: 'o1',
    maxPlayers: 14,
    paymentMethod: 'note_only',
    joinCode: 'ABC',
    attendees: [],
    teamAIds: ['a', 'b'],
    teamBIds: ['c', 'd'],
    lineupLocked: false,
    selfReportEnabled: false,
    status: 'finished',
    selfReports: [],
    ...over,
  };
}

describe('matchPlayerContribution', () => {
  it('returns zeros when no result', () => {
    const m = baseMatch({ result: undefined });
    expect(getMatchContribution(m, 'a')).toEqual({ goals: 0, assists: 0 });
  });

  it('aggregates goals and assists from StatLines', () => {
    const m = baseMatch({
      result: {
        scoreA: 2,
        scoreB: 1,
        scorers: [{ playerId: 'a', count: 2 }],
        assists: [{ playerId: 'b', count: 1 }],
        ownGoals: [],
      },
    });
    expect(getMatchContribution(m, 'a')).toEqual({ goals: 2, assists: 0 });
    expect(getMatchContribution(m, 'b')).toEqual({ goals: 0, assists: 1 });
  });

  it('sorts by goals desc, assists desc, then Turkish name', () => {
    const m = baseMatch({
      result: {
        scoreA: 3,
        scoreB: 0,
        scorers: [
          { playerId: 'x', count: 1 },
          { playerId: 'y', count: 1 },
        ],
        assists: [
          { playerId: 'y', count: 2 },
          { playerId: 'x', count: 1 },
        ],
        ownGoals: [],
      },
    });
    const rows = [
      { id: 'x', n: 'Ali' },
      { id: 'y', n: 'Veli' },
      { id: 'z', n: 'Zeki' },
    ];
    const sorted = sortPeersByMatchContribution(m, rows, (r) => r.n);
    expect(sorted.map((r) => r.id)).toEqual(['y', 'x', 'z']);
  });
});
