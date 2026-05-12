import { resolveMyMatchesEntryScreen } from '../myMatchesEntry';
import type { Match, ScoreResult } from '../../types/domain';

const remoteId = 'a0000001-0000-4000-8000-000000000011';
const user = 'u0000002-0000-4000-8000-000000000022';

function bm(partial: Partial<Match>): Match {
  const base: Match = {
    id: remoteId,
    startsAt: new Date().toISOString(),
    venue: 'Saha',
    organizerId: 'org',
    maxPlayers: 14,
    paymentMethod: 'iban',
    joinCode: 'ABC',
    attendees: [{ playerId: user, status: 'going', paid: false }],
    teamAIds: [user],
    teamBIds: [],
    lineupLocked: true,
    selfReportEnabled: false,
    status: 'upcoming',
    selfReports: [],
  };
  return { ...base, ...partial };
}

const result: ScoreResult = { scoreA: 2, scoreB: 1, scorers: [], assists: [], ownGoals: [] };

describe('resolveMyMatchesEntryScreen', () => {
  it('routes local id to MatchDetail', () => {
    const m = bm({ id: 'local-match-1' });
    expect(resolveMyMatchesEntryScreen(m, user, {})).toBe('MatchDetail');
  });

  it('routes upcoming remote to MatchDetail', () => {
    expect(resolveMyMatchesEntryScreen(bm({ status: 'upcoming' }), user, {})).toBe('MatchDetail');
  });

  it('routes ongoing remote to MatchDetail', () => {
    expect(resolveMyMatchesEntryScreen(bm({ status: 'ongoing' }), user, {})).toBe('MatchDetail');
  });

  it('routes finished without result to MatchDetail (score entered inline now)', () => {
    expect(
      resolveMyMatchesEntryScreen(bm({ status: 'finished', result: undefined }), user, {}),
    ).toBe('MatchDetail');
  });

  it('routes finished + result off lineup to MatchSummary', () => {
    expect(
      resolveMyMatchesEntryScreen(
        bm({ status: 'finished', result, teamAIds: [], teamBIds: [] }),
        user,
        {},
      ),
    ).toBe('MatchSummary');
  });

  it('routes finished + result on lineup with submission to MatchSummary', () => {
    expect(
      resolveMyMatchesEntryScreen(bm({ status: 'finished', result }), user, {
        [remoteId]: true,
      }),
    ).toBe('MatchSummary');
  });

  it('routes finished + result on lineup without submission and open window to MatchRatingFlow', () => {
    const endsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(
      resolveMyMatchesEntryScreen(
        bm({ status: 'finished', result, ratingWindowEndsAt: endsAt }),
        user,
        {},
      ),
    ).toBe('MatchRatingFlow');
  });

  it('routes finished + result on lineup with closed window to MatchSummary', () => {
    const endsAt = new Date(Date.now() - 60 * 1000).toISOString();
    expect(
      resolveMyMatchesEntryScreen(
        bm({ status: 'finished', result, ratingWindowEndsAt: endsAt }),
        user,
        {},
      ),
    ).toBe('MatchSummary');
  });

  it('routes finished + result on lineup without ratingWindowEndsAt to MatchRatingFlow', () => {
    expect(
      resolveMyMatchesEntryScreen(bm({ status: 'finished', result }), user, {}),
    ).toBe('MatchRatingFlow');
  });
});
