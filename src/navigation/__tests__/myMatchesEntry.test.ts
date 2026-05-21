import { resolveMyMatchesEntryScreen } from '../myMatchesEntry';
import type { Match, ScoreResult } from '../../types/domain';

const remoteId = 'a0000001-0000-4000-8000-000000000011';
const user = 'u0000002-0000-4000-8000-000000000022';

const pastTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2h ago
const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h from now

function bm(partial: Partial<Match>): Match {
  const base: Match = {
    id: remoteId,
    startsAt: pastTime,
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

  it('routes upcoming remote (not started) to MatchDetail', () => {
    expect(
      resolveMyMatchesEntryScreen(bm({ status: 'upcoming', startsAt: futureTime }), user, {}),
    ).toBe('MatchDetail');
  });

  it('routes cancelled remote to MatchDetail', () => {
    expect(resolveMyMatchesEntryScreen(bm({ status: 'cancelled' }), user, {})).toBe('MatchDetail');
  });

  // ── Ongoing (match started) ───────────────────────────────────────────────

  it('routes ongoing on lineup with open rating window to MatchRatingFlow', () => {
    expect(resolveMyMatchesEntryScreen(bm({ status: 'ongoing' }), user, {})).toBe(
      'MatchRatingFlow',
    );
  });

  it('routes ongoing on lineup with already submitted rating to MatchDetail', () => {
    expect(
      resolveMyMatchesEntryScreen(bm({ status: 'ongoing' }), user, { [remoteId]: true }),
    ).toBe('MatchDetail');
  });

  it('routes ongoing with rating closed by organizer to MatchDetail', () => {
    expect(
      resolveMyMatchesEntryScreen(
        bm({ status: 'ongoing', ratingClosedAt: new Date(Date.now() - 5000).toISOString() }),
        user,
        {},
      ),
    ).toBe('MatchDetail');
  });

  it('routes ongoing off lineup to MatchDetail', () => {
    expect(
      resolveMyMatchesEntryScreen(bm({ status: 'ongoing', teamAIds: [], teamBIds: [] }), user, {}),
    ).toBe('MatchDetail');
  });

  // ── Finished ─────────────────────────────────────────────────────────────

  it('routes finished without result off lineup to MatchSummary', () => {
    expect(
      resolveMyMatchesEntryScreen(
        bm({ status: 'finished', result: undefined, teamAIds: [], teamBIds: [] }),
        user,
        {},
      ),
    ).toBe('MatchSummary');
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

  it('routes finished + result on lineup with open rating window (no ratingClosedAt) to MatchRatingFlow', () => {
    expect(
      resolveMyMatchesEntryScreen(bm({ status: 'finished', result }), user, {}),
    ).toBe('MatchRatingFlow');
  });

  it('routes finished + result on lineup with open ratingWindowEndsAt (old flow) to MatchRatingFlow', () => {
    expect(
      resolveMyMatchesEntryScreen(
        bm({ status: 'finished', result, ratingWindowEndsAt: futureTime }),
        user,
        {},
      ),
    ).toBe('MatchRatingFlow');
  });

  it('routes finished + result on lineup with expired ratingWindowEndsAt (old flow) to MatchSummary', () => {
    const endsAt = new Date(Date.now() - 60 * 1000).toISOString();
    expect(
      resolveMyMatchesEntryScreen(
        bm({ status: 'finished', result, ratingWindowEndsAt: endsAt }),
        user,
        {},
      ),
    ).toBe('MatchSummary');
  });

  it('routes finished + result on lineup with rating closed by organizer to MatchSummary', () => {
    expect(
      resolveMyMatchesEntryScreen(
        bm({
          status: 'finished',
          result,
          ratingClosedAt: new Date(Date.now() - 5000).toISOString(),
        }),
        user,
        {},
      ),
    ).toBe('MatchSummary');
  });
});
