import * as matchMutations from '../../services/supabase/matchMutations';
import type { Match } from '../../types/domain';
import { setRsvpUseCase } from '../matches';

jest.mock('../../services/supabase/matchMutations', () => ({
  updateMatchOrganizerFieldsRemote: jest.fn(),
  updateMatchAttendeeRemote: jest.fn(),
  setMatchAttendeeRsvpRemote: jest.fn(),
  replaceMatchTeamPlayersRemote: jest.fn(),
  insertSelfReportRemote: jest.fn(),
  updateSelfReportStatusRemote: jest.fn(),
}));

jest.mock('../../services/supabase/matchGraph', () => ({
  fetchMatchGraph: jest.fn(),
  fetchMyMatchesGraph: jest.fn(),
}));

jest.mock('../../services/supabase/matches', () => ({
  insertMatchWithOrganizerAttendee: jest.fn(),
  joinMatchByJoinCode: jest.fn(),
  submitMatchResultRpc: jest.fn(),
  fetchMatchesForCurrentUser: jest.fn(),
}));

jest.mock('../../services/supabase/matchRatings', () => ({
  fetchMatchRatingPublicSummary: jest.fn(),
  submitMatchRatingsBundleRemote: jest.fn(),
}));

const mockSetRpc = matchMutations.setMatchAttendeeRsvpRemote as jest.MockedFunction<
  typeof matchMutations.setMatchAttendeeRsvpRemote
>;
const mockUpdate = matchMutations.updateMatchAttendeeRemote as jest.MockedFunction<
  typeof matchMutations.updateMatchAttendeeRemote
>;

const REMOTE_USER = 'a0000000-0000-4000-8000-000000000001';
const OTHER_USER = 'a0000000-0000-4000-8000-000000000002';
const REMOTE_MATCH_ID = 'f0000000-0000-4000-8000-000000000099';
const LOCAL_MATCH_ID = 'match-local-1';

function buildMatch(): Match {
  return {
    id: REMOTE_MATCH_ID,
    startsAt: '2026-06-01T18:00:00.000Z',
    venue: 'Saha 1',
    organizerId: REMOTE_USER,
    maxPlayers: 14,
    joinCode: 'JOIN0099',
    paymentMethod: 'note_only',
    attendees: [{ playerId: REMOTE_USER, status: 'going', paid: false }],
    teamAIds: [],
    teamBIds: [],
    lineupLocked: false,
    selfReportEnabled: false,
    status: 'upcoming',
    selfReports: [],
  };
}

function buildDeps(overrides: Partial<Parameters<typeof setRsvpUseCase>[0]> = {}) {
  const match = buildMatch();
  return {
    getRemoteUserId: () => REMOTE_USER as string | null,
    getLocalMatch: jest.fn().mockReturnValue(match),
    mergeHydratedRemoteMatches: jest.fn(),
    mergeRemoteGraph: jest.fn(),
    createLocalMatch: jest.fn(),
    patchLocalMatch: jest.fn(),
    joinLocalMatchByJoinCode: jest.fn(),
    setLocalRsvp: jest.fn(),
    setLocalPaid: jest.fn(),
    setLocalSelfReportEnabled: jest.fn(),
    addLocalSelfReport: jest.fn(),
    respondLocalSelfReport: jest.fn(),
    setLocalMatchTeams: jest.fn(),
    lockLocalLineup: jest.fn(),
    unlockLocalLineup: jest.fn(),
    setLocalMatchStatus: jest.fn(),
    submitLocalScore: jest.fn(),
    getMatchesSnapshot: jest.fn().mockReturnValue([match]),
    restoreMatchesSnapshot: jest.fn(),
    getPlayersSnapshot: jest.fn().mockReturnValue([]),
    restorePlayersSnapshot: jest.fn(),
    onHydrationPage: jest.fn(),
    ...overrides,
  };
}

describe('setRsvpUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('kullanıcı kendi RSVP\'sini değiştirirse idempotent RPC (setMatchAttendeeRsvpRemote) çağrılır', async () => {
    const deps = buildDeps();
    await setRsvpUseCase(deps, REMOTE_MATCH_ID, REMOTE_USER, 'maybe');

    expect(mockSetRpc).toHaveBeenCalledTimes(1);
    expect(mockSetRpc).toHaveBeenCalledWith(REMOTE_MATCH_ID, 'maybe');
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(deps.setLocalRsvp).toHaveBeenCalledWith(REMOTE_MATCH_ID, REMOTE_USER, 'maybe');
  });

  it('organizer başkasının RSVP\'sini değiştirirse direkt UPDATE (updateMatchAttendeeRemote) çağrılır', async () => {
    const deps = buildDeps();
    await setRsvpUseCase(deps, REMOTE_MATCH_ID, OTHER_USER, 'notGoing');

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(REMOTE_MATCH_ID, OTHER_USER, { status: 'notGoing' });
    expect(mockSetRpc).not.toHaveBeenCalled();
  });

  it('RPC hatası → optimistic geri alınır (restoreMatchesSnapshot çağrılır)', async () => {
    const deps = buildDeps();
    mockSetRpc.mockRejectedValueOnce(new Error('network down'));

    await expect(setRsvpUseCase(deps, REMOTE_MATCH_ID, REMOTE_USER, 'going')).rejects.toThrow(
      'network down',
    );
    expect(deps.restoreMatchesSnapshot).toHaveBeenCalledTimes(1);
  });

  it('local-only maç (remoteUserId yok veya local id) → sadece local çağrı, RPC yok', async () => {
    const deps = buildDeps({ getRemoteUserId: () => null });
    await setRsvpUseCase(deps, LOCAL_MATCH_ID, REMOTE_USER, 'going');

    expect(mockSetRpc).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(deps.setLocalRsvp).toHaveBeenCalledWith(LOCAL_MATCH_ID, REMOTE_USER, 'going');
  });
});
