import type { Match } from '../../types/domain';
import {
  canRespondToSelfReportRequest,
  isOpposingLineupPlayerToReporter,
} from '../selfReportPeerReview';

const baseMatch = (over: Partial<Match> = {}): Match =>
  ({
    id: 'm1',
    startsAt: new Date().toISOString(),
    venue: 'V',
    organizerId: 'org',
    maxPlayers: 14,
    joinCode: 'ABC',
    paymentMethod: 'note_only',
    attendees: [],
    teamAIds: ['a1', 'a2'],
    teamBIds: ['b1'],
    lineupLocked: false,
    selfReportEnabled: true,
    status: 'upcoming',
    selfReports: [],
    ...over,
  }) as Match;

describe('isOpposingLineupPlayerToReporter', () => {
  it('returns true for A vs B', () => {
    const m = baseMatch();
    expect(isOpposingLineupPlayerToReporter(m, 'a1', 'b1')).toBe(true);
    expect(isOpposingLineupPlayerToReporter(m, 'b1', 'a2')).toBe(true);
  });

  it('returns false for same team', () => {
    const m = baseMatch();
    expect(isOpposingLineupPlayerToReporter(m, 'a1', 'a2')).toBe(false);
  });

  it('returns false if viewer not on lineup', () => {
    const m = baseMatch();
    expect(isOpposingLineupPlayerToReporter(m, 'a1', 'x')).toBe(false);
  });
});

describe('canRespondToSelfReportRequest', () => {
  it('allows organizer for another player on lineup', () => {
    const m = baseMatch({ organizerId: 'org' });
    expect(canRespondToSelfReportRequest(m, 'a1', 'org')).toBe(true);
  });

  it('blocks organizer self-approve when reporter on lineup', () => {
    const m = baseMatch({ organizerId: 'org', teamAIds: ['org', 'a2'], teamBIds: ['b1'] });
    expect(canRespondToSelfReportRequest(m, 'org', 'org')).toBe(false);
  });

  it('allows organizer self-approve when reporter not on lineup', () => {
    const m = baseMatch({ organizerId: 'org', teamAIds: ['a1'], teamBIds: ['b1'] });
    expect(canRespondToSelfReportRequest(m, 'org', 'org')).toBe(true);
  });

  it('allows opposing player', () => {
    const m = baseMatch();
    expect(canRespondToSelfReportRequest(m, 'a1', 'b1')).toBe(true);
  });

  it('denies same-team non-organizer', () => {
    const m = baseMatch();
    expect(canRespondToSelfReportRequest(m, 'a1', 'a2')).toBe(false);
  });
});
