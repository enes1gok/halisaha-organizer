import type { Match } from '../../types/domain';
import { matchOutcomeForPlayer, outcomeToTrendScore, sparklineTrendScores } from '../profileMatchTrend';

const baseMatch = (over: Partial<Match> & Pick<Match, 'id' | 'startsAt'>): Match => ({
  status: 'finished',
  teamAIds: ['u1'],
  teamBIds: ['u2'],
  attendees: [],
  venue: '',
  pricePerPerson: 0,
  organizerId: 'u1',
  maxPlayers: 12,
  paymentMethod: 'note_only',
  joinCode: 'JOIN',
  lineupLocked: false,
  selfReportEnabled: false,
  selfReports: [],
  ...over,
});

describe('profileMatchTrend', () => {
  it('maps outcomes to trend scores', () => {
    expect(outcomeToTrendScore('W')).toBe(1);
    expect(outcomeToTrendScore('D')).toBe(0.5);
    expect(outcomeToTrendScore('L')).toBe(0);
  });

  it('matchOutcomeForPlayer resolves W/L/D', () => {
    const m = baseMatch({
      id: '1',
      startsAt: new Date().toISOString(),
      result: { scoreA: 2, scoreB: 1, scorers: [], assists: [], ownGoals: [] },
    });
    expect(matchOutcomeForPlayer(m, 'u1')).toBe('W');
    expect(matchOutcomeForPlayer(m, 'u2')).toBe('L');
  });

  it('sparklineTrendScores returns oldest→newest', () => {
    const older = baseMatch({
      id: 'a',
      startsAt: '2024-01-01T12:00:00.000Z',
      result: { scoreA: 1, scoreB: 0, scorers: [], assists: [], ownGoals: [] },
    });
    const newer = baseMatch({
      id: 'b',
      startsAt: '2024-06-01T12:00:00.000Z',
      result: { scoreA: 0, scoreB: 1, scorers: [], assists: [], ownGoals: [] },
    });
    const scores = sparklineTrendScores([older, newer], 'u1', 10);
    expect(scores).toEqual([1, 0]);
  });
});
